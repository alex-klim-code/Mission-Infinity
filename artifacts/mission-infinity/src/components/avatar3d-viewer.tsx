/**
 * Heavy module: Three + R3F. Only ever imported lazily (see avatar3d.tsx) so the
 * landing page bundle never pays for it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box3, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

type Entry = { promise: Promise<GLTF>; gltf: GLTF | null; refs: number; dropped: boolean; disposed: boolean };
const cache = new Map<string, Entry>();
/** Inactive (refs === 0) entries, oldest first. */
const idle = new Map<string, Entry>();
const MAX_IDLE = 8;

function dispose(root: Object3D) {
  root.traverse((o) => {
    const m = o as unknown as { geometry?: { dispose(): void }; material?: unknown };
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats as Record<string, unknown>[]) {
      for (const v of Object.values(mat)) if (v && typeof v === 'object' && 'isTexture' in v) (v as unknown as { dispose(): void }).dispose();
      (mat as unknown as { dispose(): void }).dispose();
    }
  });
}

function destroy(e: Entry) {
  if (e.disposed) return;
  e.disposed = true;
  if (e.gltf) dispose(e.gltf.scene);
  else e.promise.then((g) => dispose(g.scene)).catch(() => undefined);
}

function evictIdle() {
  while (idle.size > MAX_IDLE) {
    const [url, e] = idle.entries().next().value as [string, Entry];
    idle.delete(url);
    if (cache.get(url) === e) cache.delete(url);
    destroy(e);
  }
}

/** Acquire a ref-counted shared GLTF. Always pair with releaseEntry. */
function acquire(url: string): Entry {
  let e = cache.get(url);
  if (!e || e.disposed) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const entry: Entry = { promise: loader.loadAsync(url), gltf: null, refs: 0, dropped: false, disposed: false };
    entry.promise.then(
      (g) => {
        entry.gltf = g;
        if (entry.disposed) dispose(g.scene);
      },
      () => {
        // Only remove ourselves; never a newer entry for the same URL.
        if (cache.get(url) === entry) cache.delete(url);
        if (idle.get(url) === entry) idle.delete(url);
        entry.disposed = true;
      },
    );
    cache.set(url, entry);
    e = entry;
  }
  if (idle.get(url) === e) idle.delete(url);
  e.refs++;
  return e;
}

function releaseEntry(url: string, e: Entry) {
  e.refs = Math.max(0, e.refs - 1);
  if (e.refs > 0 || e.disposed) return;
  if (e.dropped || cache.get(url) !== e) return destroy(e);
  idle.set(url, e);
  evictIdle();
}

/** Explicit release (draft cleanup): stop caching now; dispose once no viewer uses it. */
export function releaseGltf(url: string) {
  const e = cache.get(url);
  if (!e) return;
  cache.delete(url);
  if (idle.get(url) === e) idle.delete(url);
  e.dropped = true;
  if (e.refs === 0) destroy(e);
}

/** Backwards-compatible loader (not ref-counted; prefer mounting a viewer). */
export function loadGltf(url: string): Promise<GLTF> {
  const e = acquire(url);
  releaseEntry(url, e);
  return e.promise;
}

type Framing = 'full' | 'bust';
type Props = {
  url: string;
  framing?: Framing;
  interactive?: boolean;
  onLoaded?: () => void;
  onError?: (e: unknown) => void;
  onPoster?: (blob: Blob | null) => void;
};

type Controls = { target: Vector3; update(): void; minDistance: number; maxDistance: number };

function fit(cam: PerspectiveCamera, box: Box3, framing: Framing, aspect: number) {
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const h = size.y || 1.7;
  const half = framing === 'bust' ? h * 0.2 : h * 0.56;
  const ty = framing === 'bust' ? box.max.y - h * 0.17 : center.y;
  const t = Math.tan((cam.fov * Math.PI) / 360);
  const dist = aspect < 1 ? half / (t * aspect) : half / t;
  const target = new Vector3(center.x, ty, center.z);
  cam.position.set(center.x, ty + (framing === 'bust' ? 0 : h * 0.02), center.z + dist + size.z / 2);
  cam.near = Math.max(0.01, dist / 100);
  cam.far = dist * 20;
  cam.lookAt(target);
  cam.updateProjectionMatrix();
  return { target, dist };
}

function Scene({ url, framing = 'full', interactive = true, onLoaded, onError, onPoster }: Props) {
  const [obj, setObj] = useState<Object3D | null>(null);
  const cbs = useRef({ onLoaded, onError, onPoster });
  cbs.current = { onLoaded, onError, onPoster };
  const captured = useRef(false);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let live = true;
    let clone: Object3D | null = null;
    const entry = acquire(url);
    entry.promise
      .then((g) => {
        if (!live) return;
        clone = skeletonClone(g.scene);
        clone.traverse((o) => (o.frustumCulled = false));
        setObj(clone);
      })
      .catch((e) => { if (live) cbs.current.onError?.(e); });
    return () => {
      live = false;
      // Clones own their Skeletons (bone textures); geometry/materials stay shared with the cache.
      clone?.traverse((o) => (o as unknown as { skeleton?: { dispose(): void } }).skeleton?.dispose());
      setObj(null);
      releaseEntry(url, entry);
    };
  }, [url]);

  const box = useMemo(() => (obj ? new Box3().setFromObject(obj, true) : null), [obj]);

  useEffect(() => {
    if (!obj || !box || !size.width || !size.height) return;
    const { target, dist } = fit(camera, box, framing, size.width / size.height);
    if (controls) {
      controls.target.copy(target);
      controls.minDistance = dist * 0.35;
      controls.maxDistance = dist * 1.7;
      controls.update();
    }
    invalidate();
  }, [obj, box, camera, controls, framing, size.width, size.height, invalidate]);

  useEffect(() => {
    if (!obj || !box) return;
    cbs.current.onLoaded?.();
    if (!cbs.current.onPoster || captured.current) return;
    captured.current = true;
    let live = true;
    let fired = false;
    const ids: number[] = [];
    ids.push(requestAnimationFrame(() => {
      ids.push(requestAnimationFrame(() => {
        if (!live) return;
        fired = true;
        try {
          const src = gl.domElement;
          const aspect = src.width / src.height;
          const cam = new PerspectiveCamera(24, aspect, 0.01, 100);
          fit(cam, box, 'bust', aspect);
          gl.render(scene, cam);
          const s = Math.min(src.width, src.height);
          const out = document.createElement('canvas');
          out.width = out.height = 512;
          const ctx = out.getContext('2d');
          if (!ctx) throw new Error('no 2d');
          ctx.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 512, 512);
          invalidate();
          out.toBlob((b) => live && cbs.current.onPoster?.(b && b.size > 0 ? b : null), 'image/png');
        } catch {
          if (live) cbs.current.onPoster?.(null);
        }
      }));
    }));
    return () => {
      live = false;
      ids.forEach(cancelAnimationFrame);
      if (!fired) captured.current = false;
    };
  }, [obj, box, gl, scene, invalidate]);

  return (
    <>
      {obj && <primitive object={obj} />}
      <OrbitControls makeDefault enablePan={false} enableRotate={interactive} enableZoom={interactive} enableDamping={false} autoRotate={false} />
    </>
  );
}

export default function Avatar3DViewer(props: Props) {
  const mobile = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px), (pointer: coarse)').matches, []);
  const errRef = useRef(props.onError);
  errRef.current = props.onError;
  return (
    <Canvas
      dpr={[1, mobile ? 1.25 : 1.5]}
      frameloop="demand"
      shadows={false}
      camera={{ fov: 30, position: [0, 1.4, 4] }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          errRef.current?.(new Error('context lost'));
        });
      }}
      style={{ touchAction: props.interactive === false ? 'auto' : 'none' }}
    >
      <hemisphereLight args={[0xd6ecff, 0x0b1a2c, 1.15]} />
      <directionalLight position={[1.8, 3.5, 3]} intensity={2.1} />
      <directionalLight position={[-3, 2, -2]} intensity={1.3} color="#38d7ec" />
      {!mobile && <directionalLight position={[3, 1, -3]} intensity={0.7} color="#f47b2e" />}
      <Scene {...props} />
    </Canvas>
  );
}
