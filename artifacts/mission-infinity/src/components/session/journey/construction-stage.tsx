import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Factory, Hammer, Wrench, X } from 'lucide-react';
import type { EngineeringCheck } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, formatExact, hullById, useCalm, type Props } from '../rocket-shared';
import { HangarFx } from '@/components/visual/hangar-fx';
import { TickError, Waiting, clamp01, useJourneyTicker, useNow } from './shared';

const FALLBACK = ['Engine bay', 'Propellant tanks', 'Avionics ring', 'Payload bay', 'Nose fairing'];

export function ConstructionStage({ session, mission, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const c = session.journey?.construction;
  const eng = session.engineering;
  const failed = eng?.status === 'FAILED';
  const hasIssues = !!eng && (eng.issues.length > 0 || eng.checks.some((k) => k.status === 'FAIL'));
  const hull = hullById(session.build?.selectedHullId);
  const started = !!c?.startedAt;
  const startMs = c?.startedAt ? new Date(c.startedAt).getTime() : 0;
  const running = started && !c?.delivered && !failed;
  const now = useNow(running, 100);
  const local = started && c ? clamp01((now - startMs) / Math.max(1, c.durationMs)) : 0;
  const p = c?.delivered || failed ? 1 : Math.max(c?.progress ?? 0, local);
  const built = Math.min(1, p / 0.8);
  const delivering = p >= 0.8 && !hasIssues;
  const ready = p >= 0.97 && !!c?.delivered && !hasIssues;
  const roundMonths = c ? Math.min(c.months, Math.floor(p * c.months)) : 0;
  const elapsedBefore = eng?.elapsedBefore ?? 0;
  const elapsed = elapsedBefore + roundMonths;
  const deadline = mission?.developmentMonths ?? eng?.deadlineMonths ?? 0;
  const done = !!c?.delivered;
  const ticker = useJourneyTicker(running, isHost, act, pending);

  if (!c) return <div className="p-6"><Waiting testid="status-construction-waiting">Waiting for construction orders</Waiting></div>;

  const checks: EngineeringCheck[] = eng?.checks.length
    ? eng.checks
    : FALLBACK.map((label, i) => ({ id: `s${i}`, label, status: 'PENDING', message: '' }));
  const n = checks.length;
  const revealedCount = failed || done ? n : Math.min(n, Math.floor(built * n));
  const remaining = (session.finance?.totalBudget ?? mission?.budget ?? 0) - (session.build?.spent ?? 0);
  const repairCost = 'full replacement price';

  return (
    <div className="relative z-10 overflow-x-hidden" data-testid="panel-construction">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-8">
        <div className={cn('glass hud-corners scanline relative h-[420px] overflow-hidden rounded-lg sm:h-[480px]', failed && 'border-destructive/40')} data-testid="panel-construction-hangar">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_47px,hsl(186_92%_56%/.05)_47px_48px),repeating-linear-gradient(0deg,transparent_0_47px,hsl(186_92%_56%/.05)_47px_48px)]" aria-hidden />
          <HangarFx running={running} progress={p} failed={failed} />
          {failed && <div className="absolute inset-0 bg-destructive/[.06]" aria-hidden />}
          <div className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Integration hall 2 / {failed ? 'Integration halted' : delivering ? 'Launch platform' : 'Assembly bay'}</div>
          <div className={cn('absolute bottom-6 h-2 w-28 rounded-sm transition-colors duration-700', delivering ? 'bg-burn/70' : 'bg-white/10')} style={{ right: '12%' }} aria-hidden />
          <motion.div className="absolute bottom-8 h-[78%] w-28" initial={false} animate={{ x: delivering ? 0 : '-120%' }} style={{ right: '12%' }}
            transition={calm ? { duration: 0 } : { duration: 1.6, ease: [0.65, 0, 0.35, 1] }}>
            <div className="absolute inset-0 opacity-15"><HullVisual hullId={hull?.id} className="h-full w-full" /></div>
            <div className={cn('absolute inset-0', failed && 'opacity-60 grayscale')} style={{ clipPath: `inset(${(1 - built) * 100}% 0 0 0)`, transition: calm ? 'none' : 'clip-path 0.25s linear' }}>
              <HullVisual hullId={hull?.id} className="h-full w-full" />
            </div>
            {running && !calm && <div className="absolute inset-x-0 h-px bg-ion shadow-[0_0_8px_hsl(186_92%_56%)]" style={{ bottom: `${p * 100}%` }} aria-hidden />}
          </motion.div>
          <ol className="absolute bottom-6 left-3 max-w-[55%] space-y-1">
            {checks.map((k, i) => {
              const shown = i < revealedCount;
              const fail = shown && k.status === 'FAIL';
              const ok = shown && (k.status === 'DONE' || (done && k.status !== 'FAIL'));
              return (
                <li key={k.id} title={shown && k.message ? k.message : undefined}
                  className={cn('flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider transition-opacity duration-500',
                    fail ? 'text-destructive' : ok ? 'text-ion' : shown ? 'text-foreground/70' : 'opacity-35 text-muted-foreground')}
                  data-testid={`status-construction-section-${i}`} data-status={shown ? k.status : 'PENDING'}>
                  {fail ? <X className="h-3 w-3 shrink-0" /> : ok ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0 rounded-full border border-current" />}
                  <span className="truncate">{k.label}</span>
                </li>
              );
            }).reverse()}
          </ol>
        </div>

        <div className="min-w-0">
          <div className={cn('kicker mb-2 flex items-center gap-2', failed && 'text-destructive')}>
            {failed ? <AlertTriangle className="h-3.5 w-3.5" /> : <Factory className="h-3.5 w-3.5 text-burn" />} Construction{eng && eng.attempt > 1 ? ` / attempt ${eng.attempt}` : ''}
          </div>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-construction-title">
            {failed ? 'Integration failed' : done ? 'Rocket on the platform' : started ? 'Construction in progress' : 'Build your rocket'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed
              ? 'Integration tests stopped the build. The faulty parts must be replaced before the rocket can reach the pad.'
              : `${hull?.name ?? 'Your rocket'} moves from approved design into the integration hall. Manufacturing time is accelerated: the full program plays out in seconds.`}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Construction cost</dt><dd className="mt-0.5 font-mono text-lg text-burn" data-testid="text-construction-cost">{formatExact(c.cost)}</dd></div>
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Months elapsed / deadline</dt><dd className={cn('mt-0.5 font-mono text-lg tabular-nums', deadline && elapsed > deadline && 'text-destructive')} data-testid="text-construction-months">{elapsed} / {deadline}</dd></div>
            {failed && <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Remaining budget</dt><dd className="mt-0.5 font-mono text-lg text-ion" data-testid="text-construction-remaining">{formatExact(remaining)}</dd></div>}
            {failed && <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">This build</dt><dd className="mt-0.5 font-mono text-lg tabular-nums">{roundMonths} mo</dd></div>}
          </dl>
          {!failed && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Time is based on the catalog value of your selected rocket parts, excluding the optional science payload and fuel. Construction does not charge you again; older purchase receipts stay unchanged.</p>}

          {!failed && (
            <div className="mt-4" data-testid="status-construction-progress">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>{ready ? 'Ready for fueling' : hasIssues && p >= 0.8 ? 'Running integration tests' : delivering ? 'Delivering to launch pad' : started ? 'Assembling' : 'Awaiting start'}</span><span className="tabular-nums text-ion">{Math.round(p * 100)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Construction progress">
                <div className="h-full origin-left bg-gradient-to-r from-burn to-ion" style={{ transform: `scaleX(${p})` }} />
              </div>
            </div>
          )}

          {ticker.error && <TickError onRetry={ticker.retry} testid="alert-construction-tick" />}

          {failed && eng && (
            <div className="mt-5 space-y-2" data-testid="panel-construction-failure">
              {eng.issues.map((issue) => (
                <section key={issue.id} className="rounded-md border border-destructive/40 bg-destructive/[.07] p-3" data-testid={`card-failure-${issue.id}`}>
                  <h3 className="flex items-start gap-2 font-display text-sm font-bold uppercase tracking-wider text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/85">{issue.message}</p>
                </section>
              ))}
              {eng.checks.filter((k) => k.status === 'FAIL' && k.message).map((k) => (
                <p key={k.id} className="font-mono text-[11px] text-destructive/90" data-testid={`text-failed-check-${k.id}`}>{k.label}: {k.message}</p>
              ))}
              <p className="text-[11px] text-muted-foreground">Compatibility rules are disclosed training-game rules, not verified manufacturer data.</p>
              <div className="pt-2">
                {isHost ? (
                  <HudButton variant="burn" className="w-full sm:w-auto" disabled={pending} loading={pendingAction === 'rebuild-rocket'} onClick={() => setConfirmRebuild(true)} data-testid="button-rebuild-rocket">
                    <Wrench className="h-4 w-4" /> Repair and rebuild
                  </HudButton>
                ) : <Waiting testid="text-rebuild-guest">Waiting for the Leader to order repairs</Waiting>}
              </div>
            </div>
          )}

          <div className="mt-5">
            {!started && !failed && (isHost
              ? <HudButton variant="burn" className="w-full sm:w-auto" loading={pendingAction === 'start-construction'} disabled={pending} onClick={() => act({ action: 'start-construction' })} data-testid="button-construction-start"><Hammer className="h-4 w-4" /> Wait for construction</HudButton>
              : <Waiting testid="text-construction-guest">Waiting for the Leader to start construction</Waiting>)}
            {running && !ready && <Waiting testid="text-construction-running">{hasIssues && p >= 0.8 ? 'Integration tests in progress' : delivering ? 'Transporting rocket to launch platform' : 'Crews working around the clock'}</Waiting>}
            {ready && <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[hsl(150_70%_55%)]" data-testid="status-construction-ready"><Check className="h-4 w-4" /> ROCKET READY FOR FUELING</p>}
          </div>
        </div>
      </div>

      <Dialog open={confirmRebuild} onOpenChange={setConfirmRebuild}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-burn/30 bg-card p-5" data-testid="dialog-confirm-rebuild">
          <div className="kicker text-burn">Repair order</div>
          <DialogTitle className="font-display text-xl font-bold uppercase tracking-wider">Rebuild the rocket?</DialogTitle>
          <DialogDescription asChild>
            <ul className="mt-1 space-y-1.5 text-sm text-muted-foreground">
              <li>Only the failed parts are discarded and bought again at {repairCost}. They are not refunded.</li>
              <li>Working parts and the hull are kept and locked.</li>
              <li>Money and time already spent are not reset. The next build adds months toward the {deadline}-month deadline.</li>
            </ul>
          </DialogDescription>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <HudButton variant="ghost" onClick={() => setConfirmRebuild(false)} data-testid="button-rebuild-cancel">Cancel</HudButton>
            <HudButton variant="burn" disabled={pending} onClick={() => { setConfirmRebuild(false); act({ action: 'rebuild-rocket' }); }} data-testid="button-rebuild-confirm"><Wrench className="h-4 w-4" /> Discard failed parts</HudButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
