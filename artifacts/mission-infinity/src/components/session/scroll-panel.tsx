import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bounded native scrolling; the surrounding game screen never scrolls. */
export function ScrollPanel({ children, className, innerClassName, label = 'Content', testid, resetKey }: {
  children: ReactNode; className?: string; innerClassName?: string; label?: string; testid?: string; resetKey?: string | number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTop = 0;
      viewport.current.scrollLeft = 0;
    }
  }, [resetKey]);

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', className)} data-testid={testid}>
      <div ref={viewport} role="region" aria-label={label} tabIndex={0} data-scroll-panel=""
        className="scroll-thin relative min-h-0 flex-auto overflow-y-auto overflow-x-hidden overscroll-contain focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ion">
        <div className={cn('flow-root', innerClassName)}>{children}</div>
      </div>
    </div>
  );
}
