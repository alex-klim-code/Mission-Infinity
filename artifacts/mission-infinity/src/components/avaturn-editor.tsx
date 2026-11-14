import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RotateCw, X } from 'lucide-react';
import type { AvaturnExport } from '@/lib/avatar3d';

/**
 * Standard (free) Avaturn editor in an iframe. Uses ONLY init / on('export') / destroy.
 * The SDK is dynamically imported so it never lands in the initial bundle.
 */
export function AvaturnEditor({ editorUrl, onExport, onClose }: { editorUrl: string; onExport: (r: AvaturnExport) => void; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const exportRef = useRef(onExport);
  exportRef.current = onExport;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let sdk: { destroy(): void } | null = null;
    setState('loading');
    const timeout = setTimeout(() => !cancelled && setState((s) => (s === 'loading' ? 'error' : s)), 45_000);
    import('@avaturn/sdk')
      .then(async ({ AvaturnSDK }) => {
        if (cancelled) return;
        const s = new AvaturnSDK();
        sdk = s;
        await s.init(el, { url: editorUrl });
        if (cancelled) return;
        s.on('export', (data) => {
          if (!cancelled) exportRef.current(data as AvaturnExport);
        });
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      try {
        sdk?.destroy();
      } catch {
        /* already torn down */
      }
      el.replaceChildren();
    };
  }, [editorUrl, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-void/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Avaturn avatar editor" data-testid="dialog-avaturn">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.25em] text-burn">
            <ExternalLink className="h-3 w-3" /> External provider / Avaturn
          </div>
          <p className="truncate text-xs text-muted-foreground">Build your look, then press Avaturn's export / Next button to send it back to the badge office.</p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-[.14em] hover:border-ion/60 hover:bg-ion/10" data-testid="button-close-avaturn">
          <X className="h-4 w-4" /> Close
        </button>
      </div>
      <div className="relative flex-1">
        <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0" />
        {state === 'loading' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-ion" />
            <span className="font-mono text-[10px] uppercase tracking-[.25em] text-ion">Opening secure channel to Avaturn</span>
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6" role="alert">
            <div className="glass hud-corners max-w-sm rounded-lg p-6 text-center">
              <div className="font-display text-lg font-semibold uppercase tracking-wider text-burn">Avaturn didn't respond</div>
              <p className="mt-2 text-sm text-muted-foreground">The editor couldn't load. Any draft you already exported is still here.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ion px-4 font-display text-xs font-semibold uppercase tracking-[.14em] text-void" data-testid="button-retry-avaturn">
                  <RotateCw className="h-4 w-4" /> Retry
                </button>
                <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-[.14em]">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
