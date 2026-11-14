import { AlertTriangle, Compass, RotateCw } from 'lucide-react';
import type { DemoPlan } from '@workspace/api-client-react';
import { errMsg } from '@/lib/game';
import { cn } from '@/lib/utils';
import { formatExact } from './rocket-shared';

/** Header checkbox toggle for the personal DEMO guide. */
export function DemoToggle({ enabled, onToggle, storageWarning, disabled }: { enabled: boolean; onToggle: () => void; storageWarning?: boolean; disabled?: boolean }) {
  return (
    <label
      className={cn('inline-flex h-10 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[.2em] backdrop-blur transition-colors focus-within:ring-2 focus-within:ring-[hsl(44_95%_60%)]',
        enabled ? 'border-[hsl(44_95%_60%)]/70 bg-[hsl(44_95%_60%)]/15 text-[hsl(44_95%_66%)]' : 'border-white/15 bg-void/50 text-muted-foreground hover:border-[hsl(44_95%_60%)]/50 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50')}
      title={storageWarning ? 'DEMO guide: preference could not be saved in this browser' : 'DEMO guide: personal hints only, nothing is bought automatically'}
      data-testid="toggle-demo-mode"
    >
      <input type="checkbox" className="h-3.5 w-3.5 accent-[hsl(44_95%_60%)]" checked={enabled} disabled={disabled} onChange={onToggle} aria-describedby="demo-toggle-hint" data-testid="checkbox-demo-mode" />
      Demo
      {storageWarning && <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />}
      <span id="demo-toggle-hint" className="sr-only">Highlights recommended parts for you only. No automatic purchases.</span>
    </label>
  );
}

/** Small badge on recommended cards / dialog. */
export function DemoChoiceBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm border border-[hsl(44_95%_60%)]/60 bg-[hsl(44_95%_60%)]/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[hsl(44_95%_66%)]', className)} data-testid="badge-demo-choice">
      <Compass className="h-3 w-3" aria-hidden /> DEMO choice
    </span>
  );
}

export const DEMO_RING = 'ring-2 ring-[hsl(44_95%_60%)]/70 ring-offset-2 ring-offset-[hsl(224_52%_4%)]';

export const DEMO_REASON = 'Picked as part of one full set that balances game quality, server compatibility rules and the whole budget, including a fuel reserve. Not simply the most expensive part.';

/** Compact status strip used in builder and science stage. */
export function DemoGuidePanel({ plan, loading, error, refetch, context = 'build' }: { plan: DemoPlan | undefined; loading: boolean; error: unknown; refetch: () => unknown; context?: 'build' | 'science' }) {
  const wrap = 'rounded-md border p-3 text-xs leading-snug';
  if (loading) return (
    <div className={cn(wrap, 'border-[hsl(44_95%_60%)]/30 bg-void/60')} aria-busy="true" data-testid="status-demo-loading">
      <div className="h-3 w-40 animate-pulse rounded bg-white/10" /><div className="mt-2 h-3 w-full animate-pulse rounded bg-white/5" />
    </div>
  );
  if (error || !plan) return (
    <div className={cn(wrap, 'flex flex-wrap items-center gap-2 border-destructive/40 bg-destructive/[.06]')} role="alert" data-testid="status-demo-error">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">DEMO guide unavailable: {errMsg(error, 'no plan returned.')} No hints are shown.</span>
      <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ion hover:underline" data-testid="button-demo-retry"><RotateCw className="h-3 w-3" /> Retry</button>
    </div>
  );
  if (!plan.feasible) return (
    <div className={cn(wrap, 'border-destructive/50 bg-destructive/[.07]')} role="status" data-testid="panel-demo-infeasible">
      <div className="kicker flex items-center gap-2 !text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> DEMO guide / no viable plan</div>
      <p className="mt-1 text-foreground/90" data-testid="text-demo-message">{plan.message || 'The remaining budget cannot cover a compatible configuration with a fuel reserve.'}</p>
      <p className="mt-1 text-muted-foreground">No parts are highlighted. Consider requesting funding or replacing costly parts.</p>
    </div>
  );
  return (
    <div className={cn(wrap, 'border-[hsl(44_95%_60%)]/40 bg-[hsl(44_95%_60%)]/[.06]')} role="status" data-testid="panel-demo-guide">
      <div className="kicker flex items-center gap-2 !text-[hsl(44_95%_66%)]"><Compass className="h-3.5 w-3.5" /> DEMO guide</div>
      <p className="mt-1 text-foreground/90" data-testid="text-demo-message">
        {context === 'science' ? `Highlighted ${plan.instrumentIds.length} instrument${plan.instrumentIds.length === 1 ? '' : 's'}. Tick them yourself; nothing is selected or bought for you. ` : 'Cards marked DEMO choice form one compatible set within budget. '}
        {plan.message}
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <div>Extra cost <span className="text-burn" data-testid="text-demo-additional">{formatExact(plan.additionalCost)}</span></div>
        <div>Est. total <span className="text-foreground" data-testid="text-demo-total">{formatExact(plan.estimatedTotalSpent)}</span></div>
        <div>Fuel reserve <span className="text-foreground" data-testid="text-demo-fuel">{formatExact(plan.fuelReserveCost)} / {plan.recommendedFuelKg.toLocaleString('en-US')} kg</span></div>
        <div>Left after <span className="text-ion" data-testid="text-demo-remaining">{formatExact(plan.remainingBudget)}</span></div>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground" data-testid="text-demo-disclaimer">Not a guarantee: weather and random hardware failures can still end the mission.{plan.assumptions ? ` ${plan.assumptions}` : ''}</p>
    </div>
  );
}
