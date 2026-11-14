import { motion } from 'framer-motion';
import { AlertOctagon, Microscope, Rocket } from 'lucide-react';
import type { MissionFlightTelemetryManeuver } from '@workspace/api-client-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, useCalm, type Props } from '../rocket-shared';
import { Earth, Moon, Stat, TickError, Waiting, bez, bezAngle, clamp01, fmtUtcDate, kg, num, useNow, type Pt } from './shared';

const E: Pt = { x: 120, y: 220 }, M: Pt = { x: 700, y: 110 }, C: Pt = { x: 360, y: -40 };
const W = 800, H = 300;

export const MANEUVER: Record<MissionFlightTelemetryManeuver, string> = {
  PAD: 'On the pad', LAUNCH_BURN: 'Launch burn', COAST: 'Coasting', LUNAR_INSERTION: 'Lunar orbit insertion', COMPLETE: 'Arrived', FAILED: 'Out of fuel',
};

export function MissionDayView(props: Props) {
  return <FlightView {...props} tickError={false} onRetry={() => {}} />;
}

export function FlightView({ session, isHost, act, pending, pendingAction, tickError, onRetry }: Props & { tickError: boolean; onRetry: () => void }) {
  const calm = useCalm();
  const j = session.journey!;
  const f = j.flight;
  const plan = j.plan;
  const phase = j.phase;
  const ready = phase === 'MISSION_DAY';
  const weather = ready ? j.weather.find(w => w.date === j.briefingDate) : undefined;
  const live = phase === 'FLIGHT';
  const now = useNow(live && !calm, 50);
  const started = f.startedAt ? new Date(f.startedAt).getTime() : 0;
  const local = started && plan ? clamp01((now - started) / Math.max(1, plan.animationDurationMs)) : 0;
  // Visual position only; telemetry numbers always come from the server.
  const vp = ready || !f.startedAt ? 0 : phase === 'MOON_ARRIVAL' ? 1 : phase === 'FAILED' ? f.progress : calm ? f.progress : Math.max(f.progress, Math.min(local, f.progress + 0.08, 1));
  const pos = bez(E, C, M, vp);
  const ang = bezAngle(E, C, M, Math.min(0.999, Math.max(0.001, vp)));
  const failed = phase === 'FAILED';
  const arrived = phase === 'MOON_ARRIVAL';
  const fuelPct = plan && plan.fuelLoadedKg ? (f.remainingFuelKg / plan.fuelLoadedKg) * 100 : 0;
  const days = plan?.outboundDays ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" data-testid="panel-journey-flight">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1">{plan?.routeLabel ?? 'Earth / Moon / Earth'} / outbound leg</div>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">{ready ? 'Ready for launch' : failed ? 'Mission aborted' : arrived ? 'Moon arrival' : 'In flight'}</h1>
          {ready && <p className="mt-1 text-xs text-muted-foreground" data-testid="text-launch-hold">{fmtUtcDate(j.briefingDate)} / Mission Day 1 — Engines off. Waiting for Start.</p>}
          {ready && weather && <p className="mt-1 text-xs text-muted-foreground">Launch site weather: {weather.condition.replaceAll('_', ' ').toLowerCase()}.{weather.condition === 'RAIN' && ' Rain gives a 25% chance of a failed launch needing repairs.'}</p>}
        </div>
        {ready ? isHost ? <HudButton variant="burn" disabled={pending} loading={pendingAction === 'launch-flight'} onClick={() => act({ action: 'launch-flight' })} data-testid="button-launch"><Rocket className="h-4 w-4" /> Start</HudButton> : <Waiting testid="text-launch-guest">Waiting for the Leader to press Start</Waiting> : <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Mission day</div>
          <div className="font-display text-4xl font-bold tabular-nums text-ion" data-testid="text-flight-day">{f.currentDay}<span className="text-lg text-muted-foreground"> / {days}</span></div>
        </div>}
      </div>

      <div className={cn('glass hud-corners relative mt-4 overflow-hidden rounded-lg', failed && 'border-destructive/50')} style={{ aspectRatio: `${W} / ${H}` }} data-testid="panel-flight-trajectory">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <Earth cx={E.x} cy={E.y} r={60} />
          <Moon cx={M.x} cy={M.y} r={32} />
          <path d={`M${E.x} ${E.y} Q${C.x} ${C.y} ${M.x} ${M.y}`} fill="none" stroke="hsl(210 40% 90% / .15)" strokeWidth="2" strokeDasharray="5 7" />
          <path d={`M${E.x} ${E.y} Q${C.x} ${C.y} ${M.x} ${M.y}`} fill="none" stroke={failed ? 'hsl(356 78% 58%)' : 'hsl(186 92% 56%)'} strokeWidth="2.5" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - vp} />
        </svg>
        <div className="absolute" style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%`, transform: `translate(-50%,-50%) rotate(${ang + 90}deg)` }} data-testid="img-flight-rocket">
          <HullVisual hullId={session.build?.selectedHullId} className="h-14 w-6 sm:h-20 sm:w-8 [&>div:first-child]:hidden" />
          {(f.maneuver === 'LAUNCH_BURN' || f.maneuver === 'LUNAR_INSERTION') && !calm && live && (
            <motion.div className="absolute left-1/2 top-full h-4 w-2 -translate-x-1/2 rounded-full bg-burn" animate={{ opacity: [0.5, 1, 0.5], scaleY: [0.8, 1.3, 0.8] }} transition={{ duration: 0.3, repeat: Infinity }} />
          )}
        </div>
        <div className="absolute left-3 top-3 rounded-sm border border-white/15 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest" role="status" aria-live="polite" data-testid="text-flight-maneuver">
          <span className={failed ? 'text-destructive' : 'text-ion'}>{MANEUVER[f.maneuver]}</span>
        </div>
        {arrived && (
          <motion.div initial={calm ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-x-0 bottom-3 text-center font-display text-xl font-bold uppercase tracking-[.3em] text-[hsl(150_70%_60%)] sm:text-3xl" data-testid="text-moon-arrival">Moon arrival</motion.div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
        <Stat label="Fuel remaining" value={`${kg(f.remainingFuelKg)} (${num(fuelPct)}%)`} tone={failed ? 'text-destructive' : 'text-ion'} testid="text-flight-fuel" />
        <Stat label="Consumption" value={`${num(f.consumptionKgPerSecond)} kg/s`} tone="text-burn" testid="text-flight-consumption" />
        <Stat label="Speed" value={`${num(f.speedKmPerSecond, 2)} km/s`} testid="text-flight-speed" />
        <Stat label="Mass" value={kg(f.massKg)} testid="text-flight-mass" />
      </dl>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Outbound progress" aria-valuenow={Math.round(f.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full origin-left bg-gradient-to-r from-ion to-[hsl(150_70%_55%)]" style={{ transform: `scaleX(${f.progress})` }} />
      </div>

      {tickError && <TickError onRetry={onRetry} testid="alert-flight-tick" />}

      {failed && (
        <div role="alert" className="mt-4 flex gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4" data-testid="alert-flight-failed">
          <AlertOctagon className="h-6 w-6 shrink-0 text-destructive" />
          <div><div className="font-display text-lg font-bold uppercase text-destructive">Out of fuel</div><p className="text-sm text-foreground/85">The rocket exhausted its propellant before reaching the Moon. The mission was aborted safely. Instruments cannot be diagnosed on this flight.</p></div>
        </div>
      )}
      {arrived && (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-[hsl(150_70%_55%/.4)] bg-void/70 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">Lunar orbit reached on day {f.currentDay}. Before any science, confirm every instrument survived launch.</p>
          {isHost
            ? <HudButton variant="ion" loading={pendingAction === 'check-instruments'} disabled={pending} onClick={() => act({ action: 'check-instruments' })} data-testid="button-check-instruments"><Microscope className="h-4 w-4" /> Check scientific instruments liveness</HudButton>
            : <Waiting testid="text-check-guest">Waiting for the Leader to run diagnostics</Waiting>}
        </div>
      )}
    </div>
  );
}
