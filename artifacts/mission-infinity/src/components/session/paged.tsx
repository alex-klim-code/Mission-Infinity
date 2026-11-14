import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Measured pagination: content flows naturally, and when it is taller than the
 * available space it is split into whole-element pages at element boundaries
 * (no scrolling, no scaling). Page controls stay pinned at the bottom.
 */
const ATOMIC = 'button, a, input, select, textarea, label, p, li, h1, h2, h3, h4, h5, h6, dt, dd, nav, svg, img, canvas, tr, figure, blockquote, [role="alert"], [role="status"], [role="progressbar"], [data-atomic]';

export function Paged({ children, className, innerClassName, label = 'Content', testid, resetKey }: {
  children: ReactNode; className?: string; innerClassName?: string; label?: string; testid?: string; resetKey?: string | number;
}) {
  const view = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<number[]>([0]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const raf = useRef(0);
  const wheelLock = useRef(0);
  const pointerAt = useRef(0);

  const measure = useCallback(() => {
    const v = view.current, i = inner.current;
    if (!v || !i) return;
    const H = v.clientHeight;
    const T = i.offsetHeight;
    setTotal(T);
    const rect = i.getBoundingClientRect();
    // Dialog zoom animations scale DOMRects, but clientHeight/offsetHeight
    // stay in layout pixels. Mixing the two produced stale, cut page breaks.
    const scale = i.offsetWidth ? rect.width / i.offsetWidth : 1;
    const base = rect.top;
    // Collect element boxes, treating nested pagers as single opaque blocks.
    type Box = { top: number; bottom: number; hard: boolean; soft: boolean };
    const boxes: Box[] = [];
    let contentEnd = 0;
    i.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const nested = el.parentElement?.closest('[data-paged-view]');
      if (nested && nested !== v) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) return;
      const top = (r.top - base) / (scale || 1), bottom = (r.bottom - base) / (scale || 1);
      const hard = el.matches(ATOMIC) || el.hasAttribute('data-paged-view');
      if (hard || el.childElementCount === 0) contentEnd = Math.max(contentEnd, bottom);
      boxes.push({ top, bottom, hard, soft: !hard && r.height <= Math.min(200, H * 0.45) });
    });
    contentEnd = Math.min(T, Math.ceil(contentEnd + 12));
    if (!H || contentEnd <= H + 2) { setOffsets((o) => (o.length === 1 ? o : [0])); return; }
    const candidates = [...new Set(boxes.map((b) => b.top))].sort((a, b) => a - b);
    // A break is safe when no atomic block that fits on a page straddles it.
    const straddles = (b: number, useSoft: boolean) =>
      boxes.some((x) => (x.hard || (useSoft && x.soft)) && x.bottom - x.top <= H && x.top < b - 0.05 && x.bottom > b + 0.05);
    const offs = [0];
    let start = 0;
    while (start + H < contentEnd && offs.length < 200) {
      const range = candidates.filter((b) => b > start + 1 && b <= start + H).reverse();
      let next = range.find((b) => !straddles(b, true));
      if (next === undefined) next = range.find((b) => !straddles(b, false));
      if (next === undefined) next = range[0] ?? start + H;
      if (next >= contentEnd - 1) break;
      offs.push(next);
      start = next;
    }
    setOffsets((o) => (o.length === offs.length && o.every((x, k) => x === offs[k]) ? o : offs));
  }, []);

  const schedule = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(measure); }, [measure]);

  useLayoutEffect(() => { measure(); }, [measure, children]);
  useEffect(() => {
    const ro = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    if (view.current) ro.observe(view.current);
    if (inner.current) {
      ro.observe(inner.current);
      mutations.observe(inner.current, { subtree: true, childList: true, characterData: true });
    }
    const dialog = view.current?.closest('[role="dialog"]');
    dialog?.addEventListener('animationend', schedule);
    return () => {
      ro.disconnect(); mutations.disconnect();
      dialog?.removeEventListener('animationend', schedule);
      cancelAnimationFrame(raf.current);
    };
  }, [schedule]);
  useEffect(() => { setPage(0); }, [resetKey]);

  const pages = offsets.length;
  const p = Math.min(page, pages - 1);
  const top = offsets[p] ?? 0;
  const end = p < pages - 1 ? offsets[p + 1] : total;
  const go = (n: number) => setPage(Math.max(0, Math.min(pages - 1, n)));

  return (
    <div className={cn('flex min-h-0 flex-col', className)} data-testid={testid}>
      <div
        ref={view}
        className="relative min-h-0 flex-auto overflow-hidden"
        onScroll={(e) => { e.currentTarget.scrollTop = 0; }}
        data-paged-view=""
        onPointerDownCapture={() => { pointerAt.current = Date.now(); }}
        onWheel={(e) => {
          if (pages < 2 || Math.abs(e.deltaY) < 20) return;
          e.stopPropagation();
          const now = Date.now();
          if (now - wheelLock.current < 450) return;
          wheelLock.current = now;
          go(p + (e.deltaY > 0 ? 1 : -1));
        }}
        onFocusCapture={(e) => {
          if (view.current) view.current.scrollTop = 0;
          const i = inner.current;
          if (!i || pages < 2 || Date.now() - pointerAt.current < 600) return;
          const t = e.target as HTMLElement;
          // Ignore focus that belongs to a nested pager; it manages its own pages.
          if (t.closest('[data-paged-view]') !== view.current) return;
          const r = t.getBoundingClientRect(), b = i.getBoundingClientRect().top;
          const relTop = r.top - b, relBottom = r.bottom - b;
          if (relTop >= top - 1 && relBottom <= end + 1) return;
          let k = 0;
          offsets.forEach((o, idx) => { if (o <= relTop + 1) k = idx; });
          if (k !== p) setPage(k);
        }}
      >
        <div
          ref={inner}
          className={innerClassName}
          style={pages > 1 ? { transform: `translateY(${-top}px)`, clipPath: `inset(${top}px 0 ${Math.max(0, total - end)}px 0)` } : undefined}
        >
          {children}
        </div>
      </div>
      {pages > 1 && (
        <nav className="relative z-10 flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-void/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur" aria-label={`${label} pages`}>
          <button type="button" onClick={() => go(p - 1)} disabled={p === 0} className="inline-flex min-h-8 items-center gap-1 rounded border border-white/15 px-2.5 hover:border-ion hover:text-ion disabled:opacity-40" data-testid={`${testid ?? 'paged'}-prev`}>
            <ChevronUp className="h-3.5 w-3.5" /> Prev
          </button>
          <span aria-live="polite" data-testid={`${testid ?? 'paged'}-page`}>Page {p + 1} / {pages}</span>
          <button type="button" onClick={() => go(p + 1)} disabled={p >= pages - 1} className="inline-flex min-h-8 items-center gap-1 rounded border border-white/15 px-2.5 hover:border-ion hover:text-ion disabled:opacity-40" data-testid={`${testid ?? 'paged'}-next`}>
            Next <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
