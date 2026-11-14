import { motion } from 'framer-motion';
import { Check, Factory, Hammer } from 'lucide-react';
import { HudButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { HullVisual, formatExact, hullById, useCalm, type Props } from '../rocket-shared';
import { TickError, Waiting, clamp01, useJourneyTicker, useNow } from './shared';

const SECTIONS = ['Engine bay', 'Propellant tanks', 'Avionics ring', 'Payload bay', 'Nose fairing'];

export function ConstructionStage({ session, isHost, act, pending, pendingAction }: Props) {
  const calm = useCalm();
  const c = session.journey?.construction;
  const hull = hullById(session.build?.selectedHullId);
  const started = !!c?.startedAt;
  const startMs = c?.startedAt ? new Date(c.startedAt).getTime() : 0;
  const running = started && !c?.delivered;
  const now = useNow(running, 100);
  const local = started && c ? clamp01((now - startMs) / Math.max(1, c.durationMs)) : 0;
  // Visual interpolation from the timestamp; never shown below the server value.
  const p = c?.delivered ? 1 : Math.max(c?.progress ?? 0, local);
  const built = Math.min(1, p / 0.8);
  const delivering = p >= 0.8;
  const ready = p >= 0.97;
  const months = c ? Math.min(c.months, Math.floor(p * c.months)) : 0;
  const done = !!c?.delivered;
  const ticker = useJourneyTicker(running, isHost, act, pending);

  if (!c) return <div className="p-6"><Waiting testid="status-construction-waiting">Waiting for construction orders</Waiting></div>;

  const reveal = Math.min(SECTIONS.length, Math.floor(built * SECTIONS.length + (built > 0 ? 1 : 0)));

  return (
    <div className="scroll-thin relative z-10 h-full overflow-y-auto overflow-x-hidden" data-testid="panel-construction">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-8">
        <div className="glass hud-corners scanline relative h-[420px] overflow-hidden rounded-lg sm:h-[480px]" data-testid="panel-construction-hangar">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_47px,hsl(186_92%_56%/.05)_47px_48px),repeating-linear-gradient(0deg,transparent_0_47px,hsl(186_92%_56%/.05)_47px_48px)]" aria-hidden />
          <div className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Integration hall 2 / {delivering ? 'Launch platform' : 'Assembly bay'}</div>
          {/* platform */}
          <div className={cn('absolute bottom-6 h-2 w-28 rounded-sm transition-colors duration-700', delivering ? 'bg-burn/70' : 'bg-white/10')} style={{ right: '12%' }} aria-hidden />
          <motion.div
            className="absolute bottom-8 h-[78%] w-28"
            initial={false}
            animate={{ x: delivering ? 0 : '-120%' }}
            style={{ right: '12%' }}
            transition={calm ? { duration: 0 } : { duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
          >
            {/* faint blueprint */}
            <div className="absolute inset-0 opacity-15"><HullVisual hullId={hull?.id} className="h-full w-full" /></div>
            {/* progressive build: revealed bottom up */}
            <div className="absolute inset-0" style={{ clipPath: `inset(${(1 - built) * 100}% 0 0 0)`, transition: calm ? 'none' : 'clip-path 0.25s linear' }}>
              <HullVisual hullId={hull?.id} className="h-full w-full" />
            </div>
            {running && !calm && <div className="absolute inset-x-0 h-px bg-ion shadow-[0_0_8px_hsl(186_92%_56%)]" style={{ bottom: `${p * 100}%` }} aria-hidden />}
          </motion.div>
          <ol className="absolute bottom-6 left-3 space-y-1">
            {SECTIONS.map((s, i) => (
              <li key={s} className={cn('flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider transition-opacity duration-500', i < reveal ? 'opacity-100 text-ion' : 'opacity-35 text-muted-foreground')} data-testid={`status-construction-section-${i}`}>
                {i < reveal && (p >= (i + 1) / SECTIONS.length || done) ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current" />} {s}
              </li>
            )).reverse()}
          </ol>
        </div>

        <div className="min-w-0">
          <div className="kicker mb-2 flex items-center gap-2"><Factory className="h-3.5 w-3.5 text-burn" /> Construction</div>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-construction-title">
            {done ? 'Rocket on the platform' : started ? 'Construction in progress' : 'Build your rocket'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hull?.name ?? 'Your rocket'} moves from approved design into the integration hall. Manufacturing time is accelerated: the full program plays out in seconds.
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Construction cost</dt><dd className="mt-0.5 font-mono text-lg text-burn" data-testid="text-construction-cost">{formatExact(c.cost)}</dd></div>
            <div className="bg-void/85 p-3"><dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Months elapsed</dt><dd className="mt-0.5 font-mono text-lg tabular-nums" data-testid="text-construction-months">{months} / {c.months}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Time is based on the catalog value of your selected rocket parts, excluding the optional science payload and fuel. Construction does not charge you again; older purchase receipts stay unchanged.</p>

          <div className="mt-4" data-testid="status-construction-progress">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{ready ? 'Ready for fueling' : delivering ? 'Delivering to launch pad' : started ? 'Assembling' : 'Awaiting start'}</span><span className="tabular-nums text-ion">{Math.round(p * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Construction progress">
              <div className="h-full origin-left bg-gradient-to-r from-burn to-ion" style={{ transform: `scaleX(${p})` }} />
            </div>
          </div>

          {ticker.error && <TickError onRetry={ticker.retry} testid="alert-construction-tick" />}

          <div className="mt-5">
            {!started && (isHost
              ? <HudButton variant="burn" className="w-full sm:w-auto" loading={pendingAction === 'start-construction'} disabled={pending} onClick={() => act({ action: 'start-construction' })} data-testid="button-construction-start"><Hammer className="h-4 w-4" /> Wait for construction</HudButton>
              : <Waiting testid="text-construction-guest">Waiting for the Leader to start construction</Waiting>)}
            {running && !ready && <Waiting testid="text-construction-running">{delivering ? 'Transporting rocket to launch platform' : 'Crews working around the clock'}</Waiting>}
            {ready && <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[hsl(150_70%_55%)]" data-testid="status-construction-ready"><Check className="h-4 w-4" /> ROCKET READY FOR FUELING</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
