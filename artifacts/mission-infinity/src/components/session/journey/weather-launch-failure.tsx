import { useState } from 'react';
import { CloudRain, Fuel, ShieldCheck, Wrench } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { formatExact } from '../rocket-build';
import { HullVisual, useCalm, type Props } from '../rocket-shared';
import { Waiting, clamp01, fmtUtcDate, kg, useNow } from './shared';

const DURATION = 6000;

/** Liftoff (0-35%), wind drift (35-65%), forced landing beside the pad (65-100%). */
function path(t: number) {
  if (t < 0.35) { const k = t / 0.35; return { x: 30, y: 78 - k * 46, r: k * 6 }; }
  if (t < 0.65) { const k = (t - 0.35) / 0.3; return { x: 30 + k * 22, y: 32 - Math.sin(k * Math.PI) * 6, r: 6 + k * 28 }; }
  const k = (t - 0.65) / 0.35; const e = 1 - (1 - k) * (1 - k);
  return { x: 52 + e * 10, y: 32 + e * 46, r: 34 - e * 34 };
}

export function WeatherLaunchFailureView({ session, mission, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const f = session.journey?.launchFailure;
  const started = f ? new Date(f.startedAt).getTime() : 0;
  const now = useNow(!!f && Date.now() - started < DURATION, calm ? 250 : 50);
  const elapsed = Math.max(0, now - started);
  const done = elapsed >= DURATION;
  const t = calm ? 1 : clamp01(elapsed / DURATION);
  const [confirm, setConfirm] = useState(false);
  if (!f) return <div className="p-6"><Waiting testid="status-launch-failure-waiting">Waiting for Mission Control</Waiting></div>;

  const available = (mission?.budget ?? 0) - (session.build?.spent ?? 0);
  const enough = available >= f.repairCost;
  const p = path(t);
  const landed = t >= 1;
  const shake = !calm && t > 0.35 && t < 0.65 ? Math.sin(elapsed / 40) * 1.5 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-8" data-testid="panel-launch-failure">
      <div className="kicker mb-1 flex items-center gap-2"><CloudRain className="h-3.5 w-3.5 text-[hsl(205_80%_65%)]" /> {fmtUtcDate(f.briefingDate)} / Weather abort</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">{done ? 'Forced landing' : 'Liftoff in rain'}</h1>

      <div className="glass hud-corners relative mt-3 overflow-hidden rounded-lg border-destructive/40" style={{ aspectRatio: '16 / 6' }} data-testid="panel-launch-failure-scene" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(215_35%_14%)] to-[hsl(215_30%_8%)]" />
        {!calm && Array.from({ length: 36 }, (_, i) => (
          <span key={i} className="absolute w-px bg-[hsl(205_80%_75%/.35)]" style={{ left: `${(i * 37) % 100}%`, height: 14 + (i % 4) * 4, top: `${((elapsed / (6 + (i % 3))) + i * 29) % 110 - 10}%`, transform: 'rotate(18deg)' }} />
        ))}
        {calm && <div className="absolute inset-0 bg-[repeating-linear-gradient(108deg,transparent_0_14px,hsl(205_80%_75%/.12)_14px_15px)]" />}
        <div className="absolute inset-x-0 bottom-0 h-[16%] bg-[hsl(215_20%_16%)] border-t border-white/10" />
        <div className="absolute bottom-[16%] left-[27%] h-[22%] w-[2%] bg-white/20" />
        <div className="absolute bottom-[16%] left-[25%] h-[2%] w-[10%] bg-white/30" />
        <div className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-100%) translateX(${shake}px) rotate(${p.r}deg)` }}>
          <HullVisual hullId={session.build?.selectedHullId} className="h-16 w-6 sm:h-24 sm:w-9 [&>div:first-child]:hidden" />
          {!calm && t > 0.02 && t < 0.62 && <div className="absolute left-1/2 top-full h-5 w-2 -translate-x-1/2 rounded-full bg-burn opacity-80" />}
        </div>
        {landed && <div className="absolute bottom-3 right-3 rounded-sm border border-destructive/50 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-destructive">Landed near launch site</div>}
        <div className="absolute left-3 top-3 rounded-sm border border-white/15 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-destructive" role="status">Weather abort</div>
      </div>

      {!done ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status" data-testid="text-launch-failure-progress">Rain and gusting wind at the launch site. Telemetry incoming...</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="alert-launch-failure">
            <p className="font-display font-bold uppercase text-destructive">Weather damaged the rocket</p>
            <p className="mt-1 text-foreground/85">Heavy rain and wind damaged the rocket shortly after liftoff. It made a controlled landing near the launch site. It never left Earth, but it can be repaired. The fuel was used up and must be bought again from zero. Your scientific instruments are kept.</p>
          </div>
          <dl className="glass space-y-1.5 rounded-md p-3 font-mono text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Parts cost</dt><dd data-testid="text-repair-base">{formatExact(f.repairBaseCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Repair (50%)</dt><dd className="text-burn" data-testid="text-repair-cost">{formatExact(f.repairCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Available</dt><dd className={enough ? 'text-ion' : 'text-destructive'} data-testid="text-repair-available">{formatExact(available)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Fuel lost</dt><dd>{kg(f.initialFuelKg)}</dd></div>
            <div className="pt-2">
              {isHost
                ? <HudButton variant="burn" className="w-full" disabled={!enough || pending} loading={pendingAction === 'repair-weather-launch'} onClick={() => setConfirm(true)} data-testid="button-repair-launch"><Wrench className="h-4 w-4" /> Repair rocket</HudButton>
                : <Waiting testid="text-repair-guest">Waiting for the Leader to approve repairs</Waiting>}
              {!enough && <p className={cn('mt-2 font-sans text-[11px] text-destructive')} data-testid="text-repair-insufficient">Not enough budget. Request funding in the footer.</p>}
            </div>
          </dl>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-wider">Confirm repairs</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Repair cost: <span className="text-burn">{formatExact(f.repairCost)}</span> (half of the rocket parts cost). Budget after repair: <span className="text-ion">{formatExact(available - f.repairCost)}</span>.</p>
                <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-ion" /> Instruments, assembly, science, time and history carry over.</p>
                <p className="flex gap-2"><Fuel className="h-4 w-4 shrink-0 text-burn" /> No fuel refund. The tank starts at zero and fuel must be purchased again. Then choose a new launch date.</p>
                <p>Nothing is charged until you confirm.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-repair">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending || !enough} onClick={() => act({ action: 'repair-weather-launch', requestId: f.id })} data-testid="button-confirm-repair">Pay and repair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
