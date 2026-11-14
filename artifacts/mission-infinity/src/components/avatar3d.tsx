import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Move3d, RotateCw, TriangleAlert } from 'lucide-react';
import { webglSupported } from '@/lib/avatar3d';
import { cn } from '@/lib/utils';

const Viewer = lazy(() => import('@/components/avatar3d-viewer'));

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Honest stand-in: a 3D model exists, but no snapshot of it. Never a fake face. */
export function Avatar3DPlaceholder({ name, compact, className }: { name?: string; compact?: boolean; className?: string }) {
  return (
    <div className={cn('relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden bg-[radial-gradient(circle_at_50%_35%,hsl(196_60%_20%),hsl(222_55%_7%))] text-ion', className)} role="img" aria-label={`${name ? `${name}: ` : ''}3D model on file, no snapshot`}>
      <div className="scanline absolute inset-0 opacity-60" aria-hidden />
      <Box className={compact ? 'h-[45%] w-[45%] opacity-80' : 'h-8 w-8'} strokeWidth={1.25} aria-hidden />
      {!compact && <span className="relative font-mono text-[9px] uppercase tracking-[.25em] text-ion/80">3D on file</span>}
    </div>
  );
}

type StageProps = {
  modelUrl: string;
  posterUrl?: string | null;
  name?: string;
  framing?: 'full' | 'bust';
  className?: string;
  onPoster?: (b: Blob | null) => void;
  hint?: boolean;
};

/**
 * Mounts a real WebGL viewer only while visible; unmounts offscreen to free the GPU context.
 * Explicit loading / error / unsupported states with retry.
 */
export function Avatar3DStage({ modelUrl, posterUrl, name, framing = 'full', className, onPoster, hint = true }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const supported = webglSupported();
  const posterRef = useRef(onPoster);
  posterRef.current = onPoster;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setState('loading');
  }, [modelUrl, attempt, visible]);

  useEffect(() => {
    if (!supported) posterRef.current?.(null);
  }, [supported]);

  const fail = () => {
    setState('error');
    posterRef.current?.(null);
  };

  return (
    <div ref={ref} className={cn('relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,hsl(198_55%_17%),hsl(224_52%_5%)_75%)]', className)} data-testid="viewer-avatar3d">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[repeating-linear-gradient(90deg,hsl(186_92%_56%/.07)_0_1px,transparent_1px_28px)] [mask-image:linear-gradient(to_top,black,transparent)]" aria-hidden />
      {!supported ? (
        <Fallback posterUrl={posterUrl} name={name} title="3D preview unavailable" text="This browser has WebGL turned off, so the model can't render here. Your saved model is unaffected." />
      ) : (
        <>
          {visible && state !== 'error' && (
            <Boundary key={attempt} onError={fail}>
              <Suspense fallback={null}>
                <div className={cn('absolute inset-0 transition-opacity duration-500', state === 'ready' ? 'opacity-100' : 'opacity-0')} aria-label={`${name ?? 'Engineer'} 3D model. Drag to rotate, scroll or pinch to zoom.`} role="img">
                  <Viewer url={modelUrl} framing={framing} onLoaded={() => setState('ready')} onError={fail} onPoster={onPoster ? (b) => posterRef.current?.(b) : undefined} />
                </div>
              </Suspense>
            </Boundary>
          )}
          {state === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
              {posterUrl && <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[2px]" />}
              <div className="sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ion/10 to-transparent" aria-hidden />
              <Move3d className="relative h-6 w-6 text-ion pulse-dot" aria-hidden />
              <span className="relative font-mono text-[10px] uppercase tracking-[.25em] text-ion/90">Assembling model</span>
            </div>
          )}
          {state === 'error' && (
            <Fallback posterUrl={posterUrl} name={name} title="Model failed to load" text="The 3D file didn't come through. Nothing was changed on your file." onRetry={() => setAttempt((a) => a + 1)} />
          )}
          {state === 'ready' && hint && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-sm border border-ion/25 bg-void/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[.2em] text-ion/90 backdrop-blur">Drag / pinch</div>
          )}
        </>
      )}
    </div>
  );
}

function Fallback({ posterUrl, name, title, text, onRetry }: { posterUrl?: string | null; name?: string; title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-4 text-center" role="alert">
      {posterUrl ? <img src={posterUrl} alt={`${name ?? 'Engineer'} badge snapshot`} className="absolute inset-0 h-full w-full object-cover opacity-70" /> : <Avatar3DPlaceholder name={name} className="absolute inset-0" />}
      <div className="relative w-full rounded-md border border-white/10 bg-void/80 p-3 backdrop-blur">
        <div className="flex items-center justify-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-burn">
          <TriangleAlert className="h-3.5 w-3.5" /> {title}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{text}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded border border-ion/40 px-3 font-mono text-[10px] uppercase tracking-widest text-ion hover:bg-ion/10" data-testid="button-retry-model">
            <RotateCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
