import { useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, FileBarChart, RefreshCw, ShieldCheck } from 'lucide-react';
import { getGetGameSessionQueryKey, type HardwareCheck, type MissionOperations } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Props } from '../../rocket-shared';
import { Waiting } from '../shared';

export const riskPct = (n: number) => `${Math.round(n * 10) / 10}%`;
const watchViewport = (notify: () => void) => {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};
const checkPageSize = () => window.innerWidth < 640 || window.innerHeight < 600 ? 2 : 4;

/** Paginated list of every hardware check. Pagination keeps the stage within the viewport. */
export function HardwareCheckList({ checks, perPage = 6, testid = 'list-hardware-checks' }: { checks: HardwareCheck[]; perPage?: number; testid?: string }) {
  const [page, setPage] = useState(0);
  const viewportLimit = useSyncExternalStore(watchViewport, checkPageSize, () => 4);
  const limit = Math.min(perPage, viewportLimit);
  const pages = Math.max(1, Math.ceil(checks.length / limit));
  const p = Math.min(page, pages - 1);
  const slice = checks.slice(p * limit, p * limit + limit);
  return (
    <div data-testid={testid} data-atomic="">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {slice.map((c) => {
          const bad = c.status === 'DAMAGED';
          return (
            <li key={c.id} className={cn('h-[5.25rem] rounded-md border px-2.5 py-1.5', bad ? (c.critical ? 'border-destructive/60 bg-destructive/10' : 'border-[hsl(44_95%_60%/.5)] bg-[hsl(44_95%_60%/.08)]') : 'border-white/10 bg-void/60')} data-testid={`row-hardware-check-${c.id}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold" title={c.name}>{c.name}</span>
                <span className={cn('shrink-0 font-mono text-[10px] uppercase tracking-widest', bad ? (c.critical ? 'text-destructive' : 'text-[hsl(44_95%_60%)]') : 'text-[hsl(150_70%_55%)]')} data-testid={`status-hardware-check-${c.id}`}>{bad ? 'Damaged' : 'Operational'}</span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.critical ? 'Critical: required for lunar ascent and Earth return' : 'Non-critical: return not blocked'} / Q {c.quality ?? 'n/a'} / game risk {riskPct(c.damageRisk)}{c.quality == null ? ' (estimate)' : ''}
              </div>
            </li>
          );
        })}
        {Array.from({ length: limit - slice.length }, (_, n) => (
          <li key={`empty-${n}`} className="invisible h-[5.25rem]" aria-hidden="true" />
        ))}
      </ul>
      {pages > 1 && (
        <nav className="mt-2 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-widest" aria-label="Hardware check pages">
          <button type="button" className="rounded border border-white/15 p-1 disabled:opacity-40" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page" data-testid="button-checks-prev"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span aria-live="polite" data-testid="text-checks-page">Page {p + 1} / {pages}</span>
          <button type="button" className="rounded border border-white/15 p-1 disabled:opacity-40" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page" data-testid="button-checks-next"><ChevronRight className="h-3.5 w-3.5" /></button>
        </nav>
      )}
    </div>
  );
}

export function ReturnCheckView({ session, isHost, act, pending, pendingAction, ops }: Props & { ops: MissionOperations }) {
  const qc = useQueryClient();
  const checks = ops.hardwareChecks ?? [];
  const damaged = checks.filter((c) => c.status === 'DAMAGED');
  const critical = damaged.filter((c) => c.critical);
  const minor = damaged.filter((c) => !c.critical);
  const ready = checks.length > 0;
  return (
    <section className="glass hud-corners mt-4 rounded-lg p-4" data-testid="panel-return-check">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-ion" />
        <h2 className="font-display text-lg font-bold uppercase">Pre-return hardware check</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{ready ? `${checks.length} parts / ${damaged.length} damaged` : 'Awaiting data'}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Damage was resolved once by Mission Control after lunar arrival. Percentages are game risk values, not real-world reliability.</p>

      {!ready ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-void/70 p-3" role="status" data-testid="status-checks-pending">
          <span className="flex-1 text-sm text-muted-foreground">Mission Control has not reported hardware status yet. Departure stays locked until it does.</span>
          <HudButton variant="ghost" onClick={() => void qc.invalidateQueries({ queryKey: getGetGameSessionQueryKey(session.id) })} data-testid="button-refresh-checks"><RefreshCw className="h-4 w-4" /> Refresh</HudButton>
        </div>
      ) : (
        <>
          {critical.length > 0 && (
            <div role="alert" className="mt-3 flex gap-2 rounded-md border border-destructive/60 bg-destructive/10 p-2.5" data-testid="alert-return-blocked">
              <AlertOctagon className="h-5 w-5 shrink-0 text-destructive" />
              <div className="text-xs">
                <div className="font-display text-sm font-bold uppercase text-destructive">Return impossible</div>
                Critical systems damaged: <strong data-testid="text-critical-damage">{critical.map((c) => c.name).join(', ')}</strong>. The craft cannot safely leave the Moon and reach Earth without them.
              </div>
            </div>
          )}
          {critical.length === 0 && minor.length > 0 && (
            <div role="alert" className="mt-3 flex gap-2 rounded-md border border-[hsl(44_95%_60%/.5)] bg-[hsl(44_95%_60%/.08)] p-2.5" data-testid="alert-return-caution">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(44_95%_60%)]" />
              <div className="text-xs">Minor damage on {minor.map((c) => c.name).join(', ')}. Return is still possible. The Leader decides whether to depart.</div>
            </div>
          )}
          <div className="mt-3"><HardwareCheckList checks={checks} /></div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
        {isHost && <HudButton variant="ghost" disabled={pending} onClick={() => act({ action: 'start-return', confirmReturn: false })} data-testid="button-stay-on-moon">Stay on the Moon</HudButton>}
        {!isHost ? (
          <Waiting testid="text-return-check-guest">{critical.length ? 'The Leader will open mission results' : 'The Leader decides on departure'}</Waiting>
        ) : critical.length > 0 ? (
          <HudButton variant="ion" disabled={pending} loading={pendingAction === 'view-results'} onClick={() => act({ action: 'view-results' })} data-testid="button-view-results"><FileBarChart className="h-4 w-4" /> View mission results</HudButton>
        ) : (
          <HudButton variant="burn" disabled={pending || !ready} loading={pendingAction === 'start-return'} onClick={() => act({ action: 'start-return', confirmReturn: true })} data-testid="button-confirm-return">
            <ArrowUpRight className="h-4 w-4" /> {minor.length ? 'Accept risk and return' : 'Depart for Earth'}
          </HudButton>
        )}
      </div>
    </section>
  );
}
