import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudLightning, CloudRain, CloudSun, Sun, Wind, type LucideIcon } from 'lucide-react';
import type { MissionWeatherCondition, SessionAction } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import type { ActFn } from '../session-shared';

export const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`;
export const num = (n: number, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function fmtUtcDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '--';
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

export const WEATHER: Record<MissionWeatherCondition, { label: string; icon: LucideIcon; tone: string; risk: boolean }> = {
  SUNNY: { label: 'Sunny', icon: Sun, tone: 'text-[hsl(44_95%_62%)]', risk: false },
  PARTLY_CLOUDY: { label: 'Partly cloudy', icon: CloudSun, tone: 'text-[hsl(44_70%_70%)]', risk: false },
  CLOUDY: { label: 'Cloudy', icon: Cloud, tone: 'text-[hsl(215_25%_72%)]', risk: false },
  RAIN: { label: 'Rain', icon: CloudRain, tone: 'text-[hsl(205_80%_65%)]', risk: false },
  STRONG_WIND: { label: 'Strong wind', icon: Wind, tone: 'text-[hsl(40_95%_60%)]', risk: true },
  STORM: { label: 'Storm', icon: CloudLightning, tone: 'text-destructive', risk: true },
};

/** Live clock for local visual interpolation only. Stops when inactive. */
export function useNow(active: boolean, ms = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

/**
 * Leader-only journey-tick scheduler. One request in flight at most; a failed
 * request (pending ends without the success callback) stops auto-ticking until
 * the user presses retry.
 */
export function useJourneyTicker(active: boolean, isHost: boolean, act: ActFn, pending: boolean, intervalMs = 1000) {
  const [error, setError] = useState(false);
  const inflight = useRef(false);
  const actRef = useRef(act); actRef.current = act;
  const pendingRef = useRef(pending); pendingRef.current = pending;

  useEffect(() => {
    if (!pending && inflight.current) { inflight.current = false; setError(true); }
  }, [pending]);

  const tick = useCallback(() => {
    if (inflight.current || pendingRef.current) return;
    inflight.current = true;
    actRef.current({ action: 'journey-tick' } as SessionAction, () => { inflight.current = false; });
  }, []);

  useEffect(() => {
    if (!isHost || !active || error) return;
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [isHost, active, error, tick, intervalMs]);

  const retry = useCallback(() => { setError(false); tick(); }, [tick]);
  return { error: isHost && active && error, retry };
}

export function TickError({ onRetry, testid }: { onRetry: () => void; testid: string }) {
  return (
    <div role="alert" className="mt-3 flex flex-col gap-2 rounded-md border border-destructive/40 bg-void/90 p-3 text-sm text-destructive sm:flex-row sm:items-center" data-testid={testid}>
      <span className="flex-1">Mission Control link interrupted. Automatic updates paused; your saved progress is safe.</span>
      <button type="button" onClick={onRetry} className="rounded border border-destructive/60 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-destructive/15" data-testid="button-journey-retry">Retry link</button>
    </div>
  );
}

export function Waiting({ children, testid }: { children: React.ReactNode; testid: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid={testid}>
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ion" aria-hidden />{children}
    </p>
  );
}

export function Stat({ label, value, tone, testid }: { label: string; value: string; tone?: string; testid?: string }) {
  return (
    <div className="bg-void/85 p-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-sm tabular-nums', tone)} data-testid={testid}>{value}</dd>
    </div>
  );
}

export function Earth({ r, cx, cy }: { r: number; cx: number; cy: number }) {
  return (
    <g>
      <defs>
        <radialGradient id="j-earth" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="hsl(196 85% 62%)" /><stop offset="60%" stopColor="hsl(214 75% 36%)" /><stop offset="100%" stopColor="hsl(224 70% 10%)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.18} fill="hsl(196 90% 60% / .08)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#j-earth)" />
      <path d={`M${cx - r * .55} ${cy - r * .25} q${r * .3} ${-r * .35} ${r * .6} ${-r * .1} q${r * .1} ${r * .3} ${-r * .2} ${r * .4} q${-r * .3} ${r * .05} ${-r * .4} ${-r * .3}Z`} fill="hsl(150 40% 42% / .85)" />
      <path d={`M${cx + r * .1} ${cy + r * .2} q${r * .35} ${-r * .1} ${r * .45} ${r * .25} q${-r * .1} ${r * .35} ${-r * .35} ${r * .2}Z`} fill="hsl(150 40% 42% / .8)" />
    </g>
  );
}

export function Moon({ r, cx, cy }: { r: number; cx: number; cy: number }) {
  return (
    <g>
      <defs>
        <radialGradient id="j-moon" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="hsl(40 15% 88%)" /><stop offset="70%" stopColor="hsl(220 8% 52%)" /><stop offset="100%" stopColor="hsl(224 20% 14%)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="url(#j-moon)" />
      <circle cx={cx - r * .3} cy={cy - r * .2} r={r * .18} fill="hsl(220 8% 45% / .6)" />
      <circle cx={cx + r * .25} cy={cy + r * .3} r={r * .12} fill="hsl(220 8% 45% / .55)" />
      <circle cx={cx + r * .35} cy={cy - r * .35} r={r * .08} fill="hsl(220 8% 45% / .5)" />
    </g>
  );
}

/** Quadratic bezier helpers for a fixed visual trajectory (not orbital mechanics). */
export type Pt = { x: number; y: number };
export function bez(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function bezAngle(a: Pt, c: Pt, b: Pt, t: number) {
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
