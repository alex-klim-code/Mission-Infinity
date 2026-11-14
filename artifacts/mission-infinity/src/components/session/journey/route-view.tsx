import { motion } from 'framer-motion';
import { ArrowRight, Route } from 'lucide-react';
import { HudButton } from '@/components/ui-kit';
import { useCalm, type Props } from '../rocket-shared';
import { Earth, ModelNote, Moon, Stat, Waiting, bez, kg, type Pt } from './shared';

const E: Pt = { x: 90, y: 170 }, M: Pt = { x: 400, y: 170 }, R: Pt = { x: 710, y: 170 };
const CO: Pt = { x: 245, y: 20 }, CR: Pt = { x: 555, y: 20 };

export function RouteMap({ animateRocket = true }: { animateRocket?: boolean }) {
  const calm = useCalm();
  const samples = [
    ...Array.from({ length: 24 }, (_, i) => bez(E, CO, M, i / 23)),
    ...Array.from({ length: 24 }, (_, i) => bez(M, CR, R, i / 23)),
  ];
  return (
    <svg viewBox="0 0 800 320" className="h-auto w-full" role="img" aria-label="Fixed route: Earth to Moon and back to Earth" data-testid="img-route-map">
      <Earth cx={E.x} cy={E.y} r={56} />
      <Moon cx={M.x} cy={M.y} r={30} />
      <Earth cx={R.x} cy={R.y} r={56} />
      <motion.path d={`M${E.x + 40} ${E.y - 40} Q${CO.x} ${CO.y} ${M.x - 22} ${M.y - 20}`} fill="none" stroke="hsl(186 92% 56%)" strokeWidth="2" strokeDasharray="6 6"
        initial={calm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeInOut' }} />
      <motion.path d={`M${M.x + 22} ${M.y - 20} Q${CR.x} ${CR.y} ${R.x - 40} ${R.y - 40}`} fill="none" stroke="hsl(22 96% 58%)" strokeWidth="2" strokeDasharray="6 6"
        initial={calm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 1.2, ease: 'easeInOut' }} />
      <text x={245} y={60} textAnchor="middle" className="fill-[hsl(186_92%_66%)] font-mono text-[12px] uppercase tracking-widest">Outbound</text>
      <text x={555} y={60} textAnchor="middle" className="fill-[hsl(22_96%_66%)] font-mono text-[12px] uppercase tracking-widest">Return</text>
      <text x={E.x} y={E.y + 80} textAnchor="middle" className="fill-[hsl(210_40%_90%)] font-mono text-[12px] uppercase tracking-widest">Earth</text>
      <text x={M.x} y={M.y + 52} textAnchor="middle" className="fill-[hsl(210_40%_90%)] font-mono text-[12px] uppercase tracking-widest">Moon</text>
      <text x={R.x} y={R.y + 80} textAnchor="middle" className="fill-[hsl(210_40%_90%)] font-mono text-[12px] uppercase tracking-widest">Earth</text>
      {animateRocket && !calm && (
        <motion.g initial={{ x: samples[0].x, y: samples[0].y, opacity: 0 }} animate={{ x: samples.map((s) => s.x), y: samples.map((s) => s.y), opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: 5, delay: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}>
          <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="hsl(210 40% 96%)" transform="rotate(70)" />
          <circle r="8" fill="hsl(186 92% 56% / .18)" />
        </motion.g>
      )}
    </svg>
  );
}

export function RouteView({ session, isHost, act, pending, pendingAction }: Props) {
  const plan = session.journey?.plan;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" data-testid="panel-journey-route">
      <div className="kicker mb-2 flex items-center gap-2"><Route className="h-3.5 w-3.5 text-burn" /> Stage 4 / Mission briefing</div>
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-5xl" data-testid="text-route-label">{plan?.routeLabel ?? 'Earth / Moon / Earth'}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">One fixed route, approved by Mission Control: launch from Earth, reach the Moon, collect samples and bring them home.</p>
      <div className="glass hud-corners mt-5 overflow-hidden rounded-lg p-2 sm:p-4"><RouteMap /></div>
      {plan ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-4">
            <Stat label="Outbound" value={`${plan.outboundDays} days`} tone="text-ion" testid="text-route-outbound" />
            <Stat label="Return" value={`${plan.returnDays} days`} tone="text-burn" testid="text-route-return" />
            <Stat label="Total" value={`${plan.totalDays} days`} testid="text-route-total" />
            <Stat label="Distance" value={`${plan.distanceKm.toLocaleString('en-US')} km`} testid="text-route-distance" />
            <Stat label="Fuel loaded" value={kg(plan.fuelLoadedKg)} tone="text-ion" testid="text-route-fuel" />
            <Stat label="Required (model)" value={kg(plan.requiredFuelKg)} testid="text-route-required" />
            <Stat label="Engines" value={`${plan.engineCount}`} testid="text-route-engines" />
            <Stat label="Start mass" value={`${kg(plan.initialMassKg)}${plan.massAssumed ? ' *' : ''}`} testid="text-route-mass" />
          </dl>
          {plan.fuelLoadedKg < plan.requiredFuelKg && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive" data-testid="alert-route-fuel">
            {plan.fuelLoadedKg < plan.requiredOutboundKg
              ? `Not enough propellant for the outbound transfer. The model requires ${kg(plan.requiredOutboundKg)} to reach the Moon; fuel exhaustion will halt this flight.`
              : `The outbound transfer is covered, but the modeled Earth return reserve is short by ${kg(plan.requiredFuelKg - plan.fuelLoadedKg)}. Reaching the Moon does not guarantee enough fuel to return.`}
          </p>}
          <div className="mt-3"><ModelNote testid="text-route-assumptions">{plan.assumptions}{plan.massAssumed ? ' * Some masses were assumed because catalog data is missing.' : ''}</ModelNote></div>
        </>
      ) : <p className="mt-4 text-sm text-muted-foreground" data-testid="text-route-noplan">Flight plan is being prepared by Mission Control.</p>}
      <div className="mt-5">
        {isHost
          ? <HudButton variant="burn" loading={pendingAction === 'briefing-continue'} disabled={pending} onClick={() => act({ action: 'briefing-continue' })} data-testid="button-route-continue">Continue <ArrowRight className="h-4 w-4" /></HudButton>
          : <Waiting testid="text-route-guest">Waiting for the Leader to continue</Waiting>}
      </div>
    </div>
  );
}
