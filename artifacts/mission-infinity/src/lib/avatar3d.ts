import type { Avatar3D, Avatar3DInput } from '@workspace/api-client-react';
import type { ExportAvatarResult } from '@avaturn/sdk';

/** Shape of the Avaturn SDK `export` payload (mirrors ExportAvatarResult in @avaturn/sdk 1.1.4). */
export type AvaturnExport = ExportAvatarResult;

export type Avatar3DMeta = Omit<Avatar3DInput, 'modelUploadId' | 'portraitUploadId'>;

export class AvatarPipelineError extends Error {}

const okId = (s: unknown): s is string => typeof s === 'string' && s.length >= 1 && s.length <= 128;

/** Validates the provider payload before we touch any bytes. Never echoes the URL. */
export function metaFromExport(r: AvaturnExport): Avatar3DMeta {
  if (!r || !okId(r.avatarId) || !okId(r.bodyId)) throw new AvatarPipelineError('Avaturn returned an incomplete avatar record. Export again.');
  if (r.gender !== 'female' && r.gender !== 'male') throw new AvatarPipelineError('Avaturn returned an unknown body type. Export again.');
  return { avatarId: r.avatarId, bodyId: r.bodyId, gender: r.gender, avatarSupportsFaceAnimations: !!r.avatarSupportsFaceAnimations };
}

async function readCapped(res: Response, max: number): Promise<Blob> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > max) throw new AvatarPipelineError(`The exported model is larger than ${Math.round(max / 1048576)} MiB.`);
  if (!res.body) {
    const b = await res.blob();
    if (b.size > max) throw new AvatarPipelineError(`The exported model is larger than ${Math.round(max / 1048576)} MiB.`);
    return b;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new AvatarPipelineError(`The exported model is larger than ${Math.round(max / 1048576)} MiB.`);
    }
    parts.push(value);
  }
  return new Blob(parts as BlobPart[], { type: 'model/gltf-binary' });
}

/** Turns an Avaturn export into GLB bytes, bounded, in-browser only. */
export async function readExportBlob(r: AvaturnExport, max: number, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) throw new DOMException('Transfer cancelled.', 'AbortError');
  if (r.urlType === 'dataURL') {
    const comma = r.url.indexOf(',');
    if (!r.url.startsWith('data:') || comma < 0 || !r.url.slice(0, comma).includes(';base64')) throw new AvatarPipelineError('Avaturn returned an unreadable model.');
    const b64Len = r.url.length - comma - 1;
    if (Math.floor((b64Len * 3) / 4) > max + 4) throw new AvatarPipelineError(`The exported model is larger than ${Math.round(max / 1048576)} MiB.`);
    const bin = atob(r.url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.byteLength > max) throw new AvatarPipelineError('The exported model is too large.');
    return new Blob([bytes], { type: 'model/gltf-binary' });
  }
  if (r.urlType !== 'httpURL') throw new AvatarPipelineError('Avaturn returned an unsupported export format.');
  let u: URL;
  try {
    u = new URL(r.url);
  } catch {
    throw new AvatarPipelineError('Avaturn returned an unreadable model link.');
  }
  if (u.protocol !== 'https:') throw new AvatarPipelineError('Avaturn returned an insecure model link. Export again.');
  return withTimeout(signal, 60_000, async (s) => {
    const res = await fetch(u.toString(), { signal: s, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new AvatarPipelineError('Could not download the exported model from Avaturn. Export again.');
    return readCapped(res, max);
  });
}

/** Self-contained GLB: magic "glTF", version 2, header length matches blob size. */
export async function isSelfContainedGlb(blob: Blob): Promise<boolean> {
  if (blob.size < 20) return false;
  const v = new DataView(await blob.slice(0, 12).arrayBuffer());
  return v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2 && v.getUint32(8, true) === blob.size;
}

export async function withTimeout<T>(outer: AbortSignal, ms: number, run: (s: AbortSignal) => Promise<T>): Promise<T> {
  if (outer.aborted) throw new DOMException('Transfer cancelled.', 'AbortError');
  const c = new AbortController();
  const onAbort = () => c.abort();
  outer.addEventListener('abort', onAbort);
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await run(c.signal);
  } catch (e) {
    if (outer.aborted) throw e;
    if (c.signal.aborted) throw new AvatarPipelineError('The transfer timed out. Check your connection and retry.');
    throw e;
  } finally {
    clearTimeout(t);
    outer.removeEventListener('abort', onAbort);
  }
}

/** Direct PUT to the signed storage URL. Never logs the URL. */
export async function putSigned(uploadUrl: string, blob: Blob, contentType: string, signal: AbortSignal) {
  const res = await withTimeout(signal, 180_000, (s) => fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType }, signal: s, credentials: 'omit' }));
  if (!res.ok) throw new AvatarPipelineError('Storage rejected the upload. Retry in a moment.');
}

/** Same-origin avatar file paths only. */
export function avatarFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  let local = path;
  try {
    if (!path.startsWith('/') || path.startsWith('//')) {
      if (typeof window === 'undefined') return null;
      const u = new URL(path, window.location.href);
      if (u.origin !== window.location.origin || u.search || u.hash) return null;
      local = u.pathname;
    }
    if (base && local.startsWith(`${base}/`)) local = local.slice(base.length);
    return /^\/api\/game\/avatar-files\/[0-9a-f-]{36}$/i.test(local) ? `${base}${local}` : null;
  } catch {
    return null;
  }
}

let webgl: boolean | null = null;
export function webglSupported(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

export const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError';

export type Avatar3DLike = Pick<Avatar3D, 'modelUrl' | 'portraitUrl' | 'gender'>;
export const genderLabel = (g: string) => (g === 'female' ? 'Female' : g === 'male' ? 'Male' : 'Unspecified');
