import { motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, CircleSlash, FileBarChart, XCircle } from 'lucide-react';
import type { MissionOperations } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, formatExact, useCalm, type Props } from '../../rocket-shared';
import { Earth, ModelNote, Moon, Stat, TickError, Waiting, bez, bezAngle, clamp01, kg, num, useNow, type Pt } from '../shared';
import { compOf } from './common';
import { HardwareCheckList } from './hardware-checks';

type Extra = { tickError?: boolean; onRetry?: () => void };
const M: Pt = { x: 110, y: 90 }, E: Pt = { x: 690, y: 210 }, C: Pt = { x: 420, y: -30 };
const MANEUVER: Record<string, string> = { ASCENT: 'Lunar ascent burn', RETURN_COAST: 'Coasting to Earth', EARTH_INSERTION: 'Earth insertion burn' };

function ViewResults({ isHost, act, pending, pendingAction }: Props) {
  return isHost
    ? <HudButton variant="ion" disabled={pending} loading={pendingAction === 'view-results'} onClick={() => act({ action: 'view-results' })} data-testid="button-view-results"><FileBarChart className="h-4 w-4" /> View mission results</HudButton>
    : <Waiting testid="text-results-guest">Waiting for the Leader to open results</Waiting>;
}

function ReturnFlight(p: Props & { ops: MissionOperations; failed: boolean }) {
  const { session, ops, failed } = p;
  const calm = useCalm();
  const live = !failed && !calm;
  const now = useNow(live, 120);
  const vp = ops.returnProgress;
  const drift = failed && !calm ? Math.sin(now / 900) * 0.006 : 0;
  const pos = bez(M, C, E, clamp01(vp));
  // Schematic loss trajectory: a failed insertion misses Earth instead of
  // leaving the drifting marker visually on top of the destination planet.
  if (failed && vp > 0.7) { pos.x -= 60 * clamp01((vp - 0.7) / 0.3); pos.y += 80 * vp; }
  const ang = bezAngle(M, C, E, Math.min(0.999, Math.max(0.001, vp)));
  const burning = !failed && ['ASCENT','EARTH_INSERTION'].includes(ops.returnManeuver);
  const ascent = ops.returnManeuver === 'ASCENT_FAILURE';
  const fuelPct = ops.returnInitialFuelKg ? (ops.remainingFuelKg / ops.returnInitialFuelKg) * 100 : 0;
  return (
    <>
      <div className={cn('glass hud-corners relative mt-4 overflow-hidden rounded-lg', failed && 'border-destructive/60')} style={{ aspectRatio: '800 / 300' }} data-testid="panel-return-trajectory">
        <svg viewBox="0 0 800 300" className="absolute inset-0 h-full w-full" aria-hidden>
          <Moon cx={M.x} cy={M.y} r={34} />
          <Earth cx={E.x} cy={E.y} r={62} />
          <path d={`M${M.x} ${M.y} Q${C.x} ${C.y} ${E.x} ${E.y}`} fill="none" stroke="hsl(210 40% 90% / .15)" strokeWidth="2" strokeDasharray="5 7" />
          <path d={`M${M.x} ${M.y} Q${C.x} ${C.y} ${E.x} ${E.y}`} fill="none" stroke={failed ? 'hsl(356 78% 58%)' : 'hsl(186 92% 56%)'} strokeWidth="2.5" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - vp} />
          {failed && <circle cx={E.x} cy={E.y} r="74" fill="none" stroke="hsl(356 78% 58% / .5)" strokeDasharray="4 6" />}
        </svg>
        <motion.div className="absolute" style={{ left: `${(pos.x / 800) * 100 + drift * 100}%`, top: `${(pos.y / 300) * 100}%` }}
          animate={failed && !calm ? { rotate: [ang + 90, ang + 450] } : { rotate: ang + 90 }} transition={failed ? { duration: 14, repeat: Infinity, ease: 'linear' } : { duration: 0.4 }}
          data-testid="img-return-rocket">
          <div className={cn('-translate-x-1/2 -translate-y-1/2', failed && 'opacity-60 grayscale')}>
            <HullVisual hullId={session.build?.selectedHullId} className="h-12 w-5 sm:h-16 sm:w-7 [&>div:first-child]:hidden" />
            {burning && !calm && <motion.div className="absolute left-1/2 top-full h-4 w-2 -translate-x-1/2 rounded-full bg-burn" animate={{ opacity: [0.5, 1, 0.5], scaleY: [0.8, 1.3, 0.8] }} transition={{ duration: 0.3, repeat: Infinity }} />}
          </div>
        </motion.div>
        <div className="absolute left-3 top-3 rounded-sm border border-white/15 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest" role="status" aria-live="polite" data-testid="text-return-maneuver">
          <span className={failed ? 'text-destructive' : 'text-ion'}>{failed ? (ascent ? 'Ascent failed' : 'Engines dark / drifting') : MANEUVER[ops.returnManeuver] ?? ops.returnManeuver}</span>
        </div>
        {failed && <motion.div initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-x-0 bottom-3 text-center font-display text-xl font-bold uppercase tracking-[.3em] text-destructive sm:text-3xl" data-testid="text-earth-not-reached">Earth not reached</motion.div>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
        <Stat label="Mission day" value={`${ops.missionDay}`} tone="text-ion" testid="text-return-day" />
        <Stat label="Return progress" value={`${Math.round(ops.returnProgress * 100)}%`} testid="text-return-progress" />
        <Stat label="Fuel remaining" value={`${kg(ops.remainingFuelKg)} (${num(fuelPct)}%)`} tone={failed ? 'text-destructive' : 'text-burn'} testid="text-return-fuel" />
        <Stat label="Return requires" value={kg(ops.returnRequiredKg)} testid="text-return-required" />
      </dl>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Return progress" aria-valuenow={Math.round(ops.returnProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full origin-left', failed ? 'bg-destructive' : 'bg-gradient-to-r from-ion to-[hsl(150_70%_55%)]')} style={{ transform: `scaleX(${ops.returnProgress})` }} />
      </div>
      {failed && (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-4 sm:flex-row sm:items-center" data-testid="alert-return-failed">
          <AlertOctagon className="h-6 w-6 shrink-0 text-destructive" />
          <div className="flex-1"><div className="font-display text-lg font-bold uppercase text-destructive">{ascent ? 'Earth not reached / lunar departure failed' : 'Earth not reached / out of fuel'}</div>
            <p className="text-sm text-foreground/85">{ops.failure ?? (ascent ? 'The craft could not leave the Moon.' : 'Propellant ran out on the way home.')} {ascent ? 'The craft never left lunar space' : `The craft stopped at ${Math.round(ops.returnProgress * 100)}% of the return path`}; samples and science aboard are lost.</p></div>
          <ViewResults {...p} />
        </div>
      )}
    </>
  );
}

function ReentryScene({ ops, recovery, lost }: { ops: MissionOperations; recovery: boolean; lost?: 'heat' | 'recovery' }) {
  const calm = useCalm();
  const now = useNow(!calm, 100);
  const startedAt = recovery ? ops.recoveryStartedAt : ops.reentryStartedAt;
  const dur = recovery ? 6000 : 12000;
  const raw = startedAt ? clamp01((now - new Date(startedAt).getTime()) / dur) : 0;
  const t = lost ? (calm ? 1 : (now % 4000) / 4000) : raw;
  const shield = compOf(ops.components, 'shield');
  const capsule = compOf(ops.components, 'capsule');
  const chute = compOf(ops.components, 'recovery');
  const heat = lost === 'heat' ? 1 : recovery ? 0 : Math.sin(Math.PI * Math.min(1, t * 1.2));
  const chuteOpen = !lost && (recovery || t > 0.75);
  const y = lost === 'recovery' ? 40 + t * 250 : lost === 'heat' ? 70 : recovery ? 80 + t * 170 : 30 + t * 60;
  return (
    <>
      <div className="glass hud-corners relative mt-4 overflow-hidden rounded-lg" style={{ aspectRatio: '800 / 340' }} data-testid="panel-reentry-scene">
        <svg viewBox="0 0 800 340" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="atm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(225 45% 8%)" /><stop offset=".6" stopColor={recovery ? 'hsl(205 60% 45%)' : 'hsl(215 50% 22%)'} /><stop offset="1" stopColor={recovery ? 'hsl(200 55% 60%)' : 'hsl(205 60% 40%)'} /></linearGradient>
            <radialGradient id="plasma"><stop offset="0" stopColor="hsl(40 100% 75%)" /><stop offset=".5" stopColor="hsl(18 100% 55% / .7)" /><stop offset="1" stopColor="hsl(0 90% 50% / 0)" /></radialGradient>
          </defs>
          <rect width="800" height="340" fill="url(#atm)" />
          {(recovery || lost === 'recovery') && <path d="M0 290 Q200 280 400 292 T800 286 L800 340 L0 340Z" fill="hsl(200 60% 30%)" />}
          <g transform={`translate(400 ${y})`}>
            {chuteOpen && (
              <g>
                <path d="M-46 -60 Q0 -110 46 -60 Z" fill="hsl(28 100% 58%)" stroke="hsl(210 20% 95%)" strokeWidth="1.5" />
                <path d="M-46 -60 L-12 0 M46 -60 L12 0 M0 -84 L0 0" stroke="hsl(210 20% 85%)" strokeWidth=".8" />
              </g>
            )}
            {heat > 0.05 && <ellipse cx="0" cy="26" rx={34 + heat * 24} ry={18 + heat * 40} fill="url(#plasma)" opacity={heat} />}
            <path d="M-14 -4 L14 -4 L26 22 L-26 22 Z" fill="hsl(210 15% 80%)" stroke="hsl(210 15% 40%)" />
            <path d="M-27 22 Q0 34 27 22 Z" fill={`hsl(${20 - heat * 10} ${40 + heat * 60}% ${25 + heat * 35}%)`} />
            <circle cx="0" cy="8" r="4" fill="hsl(186 92% 56%)" />
          </g>
          {lost === 'heat' && [0, 1, 2, 3].map((i) => <circle key={i} cx={400 + (i - 1.5) * 30 * (0.5 + t)} cy={90 + i * 6 + t * 80} r={4 - i * 0.6} fill="hsl(25 100% 60%)" opacity={1 - t} />)}
          {lost === 'recovery' && t > 0.85 && <circle cx="400" cy="290" r={40 * (t - 0.85) * 7} fill="hsl(25 100% 55% / .35)" />}
          {recovery && t > 0.95 && <ellipse cx="400" cy="292" rx="60" ry="5" fill="hsl(0 0% 100% / .4)" />}
        </svg>
        <div className="absolute left-3 top-3 rounded-sm border border-white/15 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ion" role="status" aria-live="polite" data-testid="status-reentry">
          {lost === 'heat' ? 'Heat shield breach / signal lost' : lost === 'recovery' ? 'No parachute / impact' : recovery ? (t >= 1 ? 'Splashdown / recovery crew en route' : 'Parachutes deployed / descending') : chuteOpen ? 'Drogue deployment' : `Peak heating ${Math.round(heat * 100)}%`}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
        <Stat label="Heat shield" value={shield ? `${shield.name} / Q${shield.quality}` : 'None'} tone={shield ? undefined : 'text-destructive'} testid="text-heat-shield" />
        <Stat label="Return capsule" value={capsule ? `${capsule.name} / Q${capsule.quality}` : 'None'} testid="text-return-capsule" />
        <Stat label="Parachute" value={chute ? `${chute.name} / Q${chute.quality}` : 'None'} tone={chute ? undefined : 'text-destructive'} testid="text-parachute" />
        <Stat label="Samples aboard" value={`${num(ops.sampleMassKg, 2)} kg`} tone="text-burn" />
        <Stat label="Mission day" value={`${ops.missionDay}`} tone="text-ion" />
      </dl>
    </>
  );
}

function Results(p: Props & { ops: MissionOperations }) {
  const calm = useCalm();
  const r = p.ops.results;
  if (!r) return <div className="mt-6 h-64 animate-pulse rounded-lg bg-white/5" data-testid="skeleton-results" />;
  const lost = r.sampleMassKg > r.recoveredSampleMassKg || r.scienceEarned > r.recoveredSciencePoints;
  return (
    <div className="mt-4" data-testid="panel-mission-results">
      <motion.div initial={calm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={cn('glass hud-corners flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-center', r.success ? 'border-[hsl(150_70%_55%/.5)]' : 'border-destructive/60')}>
        <div className="flex-1">
          <div className={cn('font-display text-2xl font-bold uppercase tracking-[.2em] sm:text-4xl', r.success ? 'text-[hsl(150_70%_60%)]' : 'text-destructive')} data-testid="text-mission-outcome">{r.success ? 'Mission success' : 'Mission failure'}</div>
          <p className="mt-1 text-sm text-muted-foreground">Main objective: safe return to Earth with at least 1 kg of lunar samples.</p>
          {r.failure && <p className="mt-1 text-sm text-destructive" data-testid="text-results-failure">{r.failure}</p>}
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Completion</div>
          <div className="font-display text-5xl font-bold tabular-nums text-ion" data-testid="text-completion-percent">{num(r.completionPercent, 1)}%</div>
        </div>
      </motion.div>
      <ul className="mt-4 space-y-2" data-testid="list-objectives">
        {r.objectives.map((o, i) => {
          const done = o.completion >= 1, none = o.completion <= 0;
          const Icon = done ? CheckCircle2 : none ? XCircle : CircleSlash;
          return (
            <motion.li key={o.id} initial={calm ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="glass rounded-md p-3" data-testid={`row-objective-${o.id}`}>
              <div className="flex items-start gap-2">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', done ? 'text-[hsl(150_70%_55%)]' : none ? 'text-destructive' : 'text-[hsl(44_95%_60%)]')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-bold">{o.label}</span><span className="font-mono text-[10px] uppercase text-muted-foreground">Weight {o.weight}% / Completed {Math.round(o.completion * 100)}%</span></div>
                  <p className="text-xs text-muted-foreground">{o.detail}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className={cn('h-full origin-left', done ? 'bg-[hsl(150_70%_55%)]' : 'bg-burn')} style={{ transform: `scaleX(${clamp01(o.completion)})` }} /></div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-3">
        <Stat label="Samples collected" value={`${num(r.sampleMassKg, 2)} kg`} testid="text-results-sample" />
        <Stat label="Samples recovered" value={`${num(r.recoveredSampleMassKg, 2)} kg`} tone="text-burn" testid="text-results-recovered-sample" />
        <Stat label="Science earned" value={`${r.scienceEarned}`} testid="text-results-science" />
        <Stat label="Science recovered" value={`${r.recoveredSciencePoints}`} tone="text-ion" testid="text-results-recovered-science" />
        <Stat label="Mission duration" value={`${r.durationDays} days`} testid="text-results-duration" />
        <Stat label="Remaining budget" value={formatExact(r.remainingBudget)} testid="text-results-budget" />
      </dl>
      {(p.ops.hardwareChecks?.length ?? 0) > 0 ? (
        <section className="mt-4 rounded-md border border-white/10 bg-white/5 p-3" data-testid="panel-results-hardware" data-atomic="">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hardware check after lunar arrival (game risk)</h3>
          <HardwareCheckList checks={p.ops.hardwareChecks!} testid="list-results-hardware" />
        </section>
      ) : p.ops.equipment.filter(e => e.id.startsWith('scientific-instruments-')).map(e => (
        <div key={e.id} className={cn('mt-4 rounded-md border p-3 text-sm', e.status === 'DAMAGED' ? 'border-destructive/40 bg-destructive/10' : 'border-white/10 bg-white/5')} data-testid="text-builder-instrument-result" role="status">
          <h3 className="font-bold">Rocket Builder — Scientific Instruments</h3>
          <p className="mt-1">{e.name}: <strong>{e.status === 'DAMAGED' ? 'Damaged' : 'Operational'}</strong></p>
          <p className="mt-1 text-xs text-muted-foreground">{e.warning ?? 'The instrument survived the mission. Lowest-priced variant: 50% damage chance.'}</p>
        </div>
      ))}
      {lost && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground/85" data-testid="text-results-lost">Samples and science gathered on the Moon only count once recovered on Earth. Everything that did not come home is lost.</p>}
    </div>
  );
}

export function ReturnGameplayStage(props: Props & Extra) {
  const { session, tickError = false, onRetry = () => {} } = props;
  const j = session.journey;
  const ops = j?.operations;
  if (!j || !ops) return <div className="mx-auto max-w-5xl px-4 py-6"><div className="h-64 animate-pulse rounded-lg bg-white/5" data-testid="skeleton-return" /></div>;
  const ph = j.phase;
  const capsuleLost = ops.returnManeuver === 'HEAT_SHIELD_FAILURE' ? 'heat' as const : ops.returnManeuver === 'RECOVERY_FAILURE' ? 'recovery' as const : undefined;
  const stage = ph === 'RESULTS' ? 'Stage 8 / Mission results' : 'Stage 7 / Return to Earth';
  const title = { RETURN_FLIGHT: 'Homebound', RETURN_FAILED: capsuleLost ? 'Capsule lost' : ops.returnManeuver === 'ASCENT_FAILURE' ? 'Lunar departure failed' : 'Lost in cislunar space', REENTRY: 'Atmospheric reentry', RECOVERY: 'Recovery', LANDING_FAILED: 'Capsule lost', RESULTS: 'Mission results' }[ph as string] ?? 'Return';
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" data-testid="panel-journey-return">
      <div className="kicker mb-1">{stage}</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-return-title">{title}</h1>
      {(ph === 'RETURN_FLIGHT' || (ph === 'RETURN_FAILED' && !capsuleLost)) && <ReturnFlight {...props} ops={ops} failed={ph === 'RETURN_FAILED'} />}
      {ph === 'RETURN_FAILED' && capsuleLost && (
        <>
          <ReentryScene ops={ops} recovery={false} lost={capsuleLost} />
          <div role="alert" className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-4 sm:flex-row sm:items-center" data-testid="alert-capsule-lost">
            <AlertOctagon className="h-6 w-6 shrink-0 text-destructive" />
            <div className="flex-1"><div className="font-display text-lg font-bold uppercase text-destructive" data-testid="text-capsule-lost">Capsule lost</div>
              <p className="text-sm text-foreground/85">{ops.failure ?? (capsuleLost === 'heat' ? 'The re-entry heat shield failed during atmospheric entry.' : 'The recovery system failed and the capsule impacted.')} Earth was reached, but the samples and science aboard were not recovered.</p></div>
            <ViewResults {...props} />
          </div>
        </>
      )}
      {(ph === 'REENTRY' || ph === 'RECOVERY') && <ReentryScene ops={ops} recovery={ph === 'RECOVERY'} />}
      {ph === 'LANDING_FAILED' && (
        <>
          <div className="glass hud-corners relative mt-4 overflow-hidden rounded-lg border-destructive/60" style={{ aspectRatio: '800 / 300' }} data-testid="panel-impact-scene">
            <svg viewBox="0 0 800 300" className="absolute inset-0 h-full w-full" aria-hidden>
              <rect width="800" height="300" fill="hsl(220 30% 10%)" />
              <path d="M0 240 Q400 225 800 240 L800 300 L0 300Z" fill="hsl(30 8% 30%)" />
              <circle cx="400" cy="236" r="70" fill="hsl(18 100% 50% / .25)" />
              <path d="M380 240 L360 200 M420 238 L446 198 M400 232 L402 186 M370 244 L330 228 M430 244 L474 230" stroke="hsl(30 10% 65%)" strokeWidth="3" strokeLinecap="round" />
              <path d="M386 236 L414 236 L420 224 L392 220 Z" fill="hsl(210 10% 40%)" transform="rotate(-24 400 230)" />
            </svg>
            <div className="absolute inset-x-0 bottom-3 text-center font-display text-xl font-bold uppercase tracking-[.3em] text-destructive">Impact</div>
          </div>
          <div role="alert" className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/60 bg-destructive/10 p-4 sm:flex-row sm:items-center" data-testid="alert-landing-failed">
            <AlertOctagon className="h-6 w-6 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-foreground/85">{ops.failure ?? 'The vehicle was destroyed on impact.'} Samples and science aboard are lost.</p>
            <ViewResults {...props} />
          </div>
        </>
      )}
      {ph === 'RESULTS' && <Results {...props} ops={ops} />}
      {tickError && <TickError onRetry={onRetry} testid="alert-return-tick" />}
      <div className="mt-4"><ModelNote>Fuel, heating and recovery outcomes come from Mission Control using your selected components. Visuals are illustrative.</ModelNote></div>
    </div>
  );
}
