import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Moon as MoonIcon } from 'lucide-react';
import type { InstrumentDiagnosticStatus } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, useCalm, type Props } from '../rocket-shared';
import { TickError, Waiting } from './shared';

export const DIAG: Record<InstrumentDiagnosticStatus, { label: string; tone: string; bar: string }> = {
  UNKNOWN: { label: 'Unknown', tone: 'text-muted-foreground', bar: 'bg-ion' },
  OPERATIONAL: { label: 'Operational', tone: 'text-[hsl(150_70%_55%)]', bar: 'bg-[hsl(150_70%_55%)]' },
  DAMAGED: { label: 'Damaged', tone: 'text-[hsl(44_95%_60%)]', bar: 'bg-[hsl(44_95%_60%)]' },
  CRITICAL_FAILURE: { label: 'Critical failure', tone: 'text-destructive', bar: 'bg-destructive' },
};

export function DiagnosticsView({ session, isHost, act, pending, pendingAction, tickError, onRetry }: Props & { tickError: boolean; onRetry: () => void }) {
  const calm = useCalm();
  const j = session.journey!;
  const list = j.diagnostics;
  const initializing = !j.diagnosticsComplete && list.every((d) => d.progress <= 0);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8" data-testid="panel-journey-diagnostics">
      <div className="kicker mb-2">Lunar orbit / payload check</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">{j.diagnosticsComplete ? 'Diagnostics complete' : 'Instrument diagnostics'}</h1>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Diagnostics progress" aria-valuenow={Math.round(j.diagnosticsProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full origin-left bg-gradient-to-r from-ion to-[hsl(150_70%_55%)] transition-transform duration-500" style={{ transform: `scaleX(${j.diagnosticsProgress})` }} />
        </div>
        <span className="font-mono text-xs tabular-nums text-ion" data-testid="text-diagnostics-progress">{Math.round(j.diagnosticsProgress * 100)}%</span>
      </div>
      {initializing && <p className={cn('mt-3 font-mono text-xs uppercase tracking-[.25em] text-ion', !calm && 'pulse-dot')} role="status" data-testid="status-diagnostics-init">Initializing scientific systems</p>}

      <ul className="mt-4 space-y-2" data-testid="list-diagnostics-results">
        {list.length === 0 && <li className="rounded-md border border-white/10 bg-void/60 p-4 text-sm text-muted-foreground" data-testid="text-diagnostics-empty">No scientific instruments aboard. Nothing to diagnose; science potential is zero.</li>}
        {list.map((d, i) => {
          const s = DIAG[d.status];
          return (
            <motion.li key={d.instrumentId} initial={calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-md p-3" data-testid={`row-diagnostic-${d.instrumentId}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 font-display text-sm font-bold uppercase [overflow-wrap:anywhere]">{d.name}</span>
                <span className={cn('flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest', s.tone)} data-testid={`status-diagnostic-${d.instrumentId}`}>
                  <span className={cn('h-2 w-2 rounded-full', d.status === 'UNKNOWN' ? 'bg-white/25' : s.bar)} /> {d.status === 'UNKNOWN' && d.progress > 0 ? 'Testing' : s.label}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className={cn('h-full origin-left transition-transform duration-500', s.bar)} style={{ transform: `scaleX(${d.progress})` }} /></div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                <span>Quality {d.quality}</span>
                <span data-testid={`text-diagnostic-points-${d.instrumentId}`}>Science potential {d.status === 'UNKNOWN' ? '--' : d.availableSciencePoints} / {d.maxSciencePoints}</span>
              </div>
              {d.failure && <p className={cn('mt-1 text-xs', s.tone)}>{d.failure}</p>}
            </motion.li>
          );
        })}
      </ul>

      {tickError && <TickError onRetry={onRetry} testid="alert-diagnostics-tick" />}

      {j.diagnosticsComplete && (
        <div className="mt-5 rounded-md border border-white/10 bg-void/70 p-4" data-testid="panel-diagnostics-summary">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Available science potential</div>
          <div className="font-display text-3xl font-bold tabular-nums text-ion" data-testid="text-diagnostics-available">{j.availableSciencePoints} <span className="text-base text-muted-foreground">/ {j.maxSciencePoints} max</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Potential only. Points are earned during lunar operations, not now.</p>
          <div className="mt-4">
            {isHost
              ? <HudButton variant="burn" loading={pendingAction === 'continue-lunar'} disabled={pending} onClick={() => act({ action: 'continue-lunar' })} data-testid="button-diagnostics-continue">Continue to lunar operations <ArrowRight className="h-4 w-4" /></HudButton>
              : <Waiting testid="text-diagnostics-guest">Waiting for the Leader to continue</Waiting>}
          </div>
        </div>
      )}
    </div>
  );
}

export function LunarHandoff({ session }: Props) {
  const j = session.journey!;
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10 md:grid-cols-[160px_1fr] md:px-8" data-testid="panel-journey-lunar">
      <HullVisual hullId={session.build?.selectedHullId} className="mx-auto h-56 w-full" />
      <div className="self-center">
        <div className="kicker mb-2 flex items-center gap-2"><MoonIcon className="h-3.5 w-3.5 text-burn" /> Stage 5</div>
        <h1 className="font-display text-4xl font-bold uppercase leading-tight sm:text-6xl" data-testid="text-lunar-title">Lunar operations</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-[hsl(150_70%_55%)]" /> In lunar orbit with {j.availableSciencePoints} / {j.maxSciencePoints} science potential available.</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid="text-lunar-next">Sample collection opens in the next mission phase. Stand by for Mission Control.</p>
      </div>
    </div>
  );
}
