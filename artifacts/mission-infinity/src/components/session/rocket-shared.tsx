import { useReducedMotion } from 'framer-motion';
import {
  Anchor, BatteryCharging, Boxes, Cable, Coins, Compass, Cpu, Flame, Fuel, Gauge, Layers, Radar, Radio, Rocket, Satellite, Scissors, Shield, Sun, Thermometer, Umbrella, Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { GameSession, Mission, RocketComponent, SessionActionHullId } from '@workspace/api-client-react';
import { imgUrl } from '@/lib/game';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { ActFn } from './session-shared';

export const HULLS: { id: SessionActionHullId; name: string; colors: string; price: number; image: string }[] = [
  { id: 'falcon-shadow', name: 'Falcon Shadow', colors: 'black and white', price: 50000000, image: '/api/game/story-images/falcon-shadow.webp' },
  { id: 'titan-explorer', name: 'Titan Explorer', colors: 'orange and white', price: 60000000, image: '/api/game/story-images/titan-explorer.webp' },
  { id: 'nova-prime', name: 'Nova Prime', colors: 'white and blue', price: 90000000, image: '/api/game/story-images/nova-prime.webp' },
];

export const hullById = (id: string | null | undefined) => HULLS.find((h) => h.id === id);
export const formatExact = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const fmtSigned = (n: number) => (n === 0 ? '$0' : `${n > 0 ? '+' : '-'}${formatExact(Math.abs(n))}`);
export const fmtKg = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} kg`;

export const BODY_CATEGORY = 'rocket-body';
export const isHullOption = (o: RocketComponent) => o.categoryId === BODY_CATEGORY || !!hullById(o.id);

export type Props = { session: GameSession; mission?: Mission; me: string; isHost: boolean; act: ActFn; pending: boolean; pendingAction?: string };

export function useCalm() {
  const sys = useReducedMotion();
  const { reducedMotion } = usePrefs();
  return !!sys || reducedMotion;
}

export function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono', className)}>
      <Coins className="h-3.5 w-3.5 text-burn" aria-hidden /> {formatExact(value)}
    </span>
  );
}

export function HullVisual({ hullId, className }: { hullId?: string | null; className?: string }) {
  const hull = hullById(hullId);
  if (!hull)
    return (
      <div className={cn('relative flex items-center justify-center', className)} data-testid="img-hull-placeholder">
        <svg viewBox="0 0 60 180" className="h-full w-auto opacity-60" aria-hidden>
          <path d="M30 4 C44 24 46 52 46 70 L46 150 L54 172 L6 172 L14 150 L14 70 C14 52 16 24 30 4 Z" fill="none" stroke="hsl(186 92% 56% / .5)" strokeWidth="1.2" strokeDasharray="4 4" />
        </svg>
        <span className="absolute rounded-sm border border-white/15 bg-void/85 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Not purchased</span>
      </div>
    );
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className="absolute inset-x-8 bottom-1 h-5 rounded-full bg-burn/30 blur-xl" />
      <img src={imgUrl(hull.image)} alt={`${hull.name} rocket hull`} width={724} height={2172} className="relative h-full w-auto max-w-full object-contain" data-testid="img-builder-hull" />
    </div>
  );
}

/** First real fragment of the catalog description, used on cards only. */
export function shortDescription(o: RocketComponent) {
  const pick = (s: string) => s.split(' | ').map((x) => x.trim()).find((x) => x && x !== '--') ?? '';
  return pick(o.description || '') || pick(o.parameters || '');
}

const ICONS: [RegExp, LucideIcon][] = [
  [/body|hull/i, Rocket],
  [/engine|thrust|motor|propuls/i, Flame],
  [/tank|fuel|propellant|oxidi/i, Fuel],
  [/separat|stage|decoupl/i, Scissors],
  [/parachute|recover/i, Umbrella],
  [/landing|leg/i, Anchor],
  [/guidance|navig|gyro|imu|attitude/i, Compass],
  [/computer|avionic|flight control|processor/i, Cpu],
  [/sensor|radar|camera|telemetry/i, Radar],
  [/comm|antenna|radio|transmit/i, Radio],
  [/solar/i, Sun],
  [/power|battery|electr/i, BatteryCharging],
  [/therm|heat|cool|insul/i, Thermometer],
  [/fairing|shield|protect/i, Shield],
  [/payload|satellite/i, Satellite],
  [/cabl|wir|harness/i, Cable],
  [/valve|pump|pipe|plumb|regulat/i, Gauge],
  [/structur|frame|adapter|interstage/i, Layers],
  [/tool|mount|fitting/i, Wrench],
];
export const categoryIcon = (c: { id: string; name: string }): LucideIcon =>
  ICONS.find(([r]) => r.test(c.id) || r.test(c.name))?.[1] ?? Boxes;
