import { useEffect, useRef, useState, type ReactNode } from 'react';
import { VideoOff } from 'lucide-react';
import type { MissionOperations } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { LanderSvg, compOf, landerVariant } from './common';

const GROUND = 292;
const TOP = 70;
const SPAN = GROUND - TOP;

/** Readable altitude mapping: linear in the final 150 m, compressed above. */
function altToPx(alt: number) {
  const a = Math.max(0, alt);
  if (a <= 150) return (a / 150) * SPAN * 0.82;
  const extra = Math.min(1, Math.log10(a / 150) / Math.log10(2000 / 150));
  return SPAN * (0.82 + 0.18 * extra);
}

/** Smoothly chase the authoritative altitude between server updates. Never invents gameplay. */
function useSmoothAlt(target: number, active: boolean, calm: boolean) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  const tgt = useRef(target);
  tgt.current = target;
  useEffect(() => {
    if (!active || calm) { cur.current = tgt.current; setShown(tgt.current); return; }
    let raf = 0; let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      const diff = tgt.current - cur.current;
      cur.current += diff * (1 - Math.exp(-dt * 6));
      if (Math.abs(diff) < 0.02) cur.current = tgt.current;
      setShown(cur.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, calm]);
  useEffect(() => { if (!active || calm) { cur.current = target; setShown(target); } }, [target, active, calm]);
  return shown;
}

function useClock(on: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0; const s = performance.now();
    const loop = (n: number) => { setT((n - s) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}

export function LandingScene({ ops, calm, children }: { ops: MissionOperations; calm: boolean; children: ReactNode }) {
  const L = ops.landing;
  const variant = landerVariant(compOf(ops.components, 'lander')?.name);
  const crashed = L.status === 'CRASHED';
  const landed = L.status === 'LANDED';
  const descending = L.status === 'DESCENDING';
  const animate = descending && !calm && ops.hasCamera;
  const alt = useSmoothAlt(landed || crashed ? 0 : L.altitudeM, descending && ops.hasCamera, calm);
  const t = useClock(animate);

  // Restrained touchdown pulse, only on transition DESCENDING -> LANDED/CRASHED while watching.
  const prev = useRef(L.status);
  const [touch, setTouch] = useState(0);
  useEffect(() => {
    if (prev.current === 'DESCENDING' && (landed || crashed) && !calm) setTouch((k) => k + 1);
    prev.current = L.status;
  }, [L.status, landed, crashed, calm]);

  if (!ops.hasCamera)
    return (
      <div className="absolute inset-0 grid place-items-center bg-[hsl(220_20%_3%)]" data-testid="panel-no-video">
        <div className="text-center">
          <VideoOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className={cn('mt-2 font-mono text-lg tracking-[.4em] text-muted-foreground', !calm && 'pulse-dot')}>NO VIDEO SIGNAL</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">{ops.alternativeNavigation ? 'Flying on radar / inertial navigation telemetry' : 'No navigation source available'}</div>
        </div>
      </div>
    );

  const y = GROUND - (landed || crashed ? 0 : altToPx(alt));
  const thrust = descending ? L.thrust / 100 : 0;
  const flicker = animate ? 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 13 + 1) : 1;
  const flame = thrust * flicker;
  const sway = animate ? Math.sin(t * 1.3) * 0.8 : 0;
  const dust = descending ? Math.max(0, 1 - alt / 45) * Math.max(0.25, thrust) : 0;
  const ticks = [0, 25, 50, 75, 100, 150, 300, 1000];

  return (
    <svg viewBox="0 0 800 360" className="absolute inset-0 h-full w-full" aria-hidden>
      {children}
      {/* altitude ladder */}
      <g fontFamily="monospace" fontSize="9" fill="hsl(186 92% 66% / .7)">
        <line x1="40" y1={GROUND - SPAN} x2="40" y2={GROUND} stroke="hsl(186 92% 56% / .25)" />
        {ticks.map((m) => { const ty = GROUND - altToPx(m); return (
          <g key={m}><line x1="36" x2="44" y1={ty} y2={ty} stroke="hsl(186 92% 56% / .45)" /><text x="48" y={ty + 3}>{m}</text></g>
        ); })}
        {!crashed && <path d={`M30 ${y - 4} L38 ${y} L30 ${y + 4}Z`} fill="hsl(22 96% 58%)" />}
      </g>
      {/* landing target + shadow */}
      {descending && <ellipse cx="400" cy={GROUND + 4} rx={10 + 26 * (1 - Math.min(1, alt / 150))} ry="3" fill="hsl(224 52% 4% / .45)" />}
      {/* engine glow on ground */}
      {dust > 0 && <ellipse cx="400" cy={GROUND + 3} rx={40 + dust * 50} ry={4 + dust * 4} fill={`hsl(28 100% 60% / ${0.12 * dust * flicker})`} />}
      {/* dust plume */}
      {dust > 0 && !calm && Array.from({ length: 14 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const ph = ((t * 1.4 + i * 0.137) % 1);
        const dx = side * (14 + ph * (70 + 60 * dust) + (i % 3) * 6);
        return <circle key={i} cx={400 + dx} cy={GROUND + 2 - ph * (6 + (i % 4) * 3)} r={2 + ph * 5}
          fill={`hsl(30 10% 76% / ${(1 - ph) * 0.45 * dust})`} />;
      })}
      {dust > 0 && calm && <ellipse cx="400" cy={GROUND + 1} rx={30 + dust * 60} ry="5" fill={`hsl(30 10% 75% / ${0.3 * dust})`} />}
      <g transform={`translate(400 ${y - 8}) rotate(${sway}) scale(1.4)`}>
        {flame > 0.02 && <ellipse cx="0" cy={6 + flame * 18} rx={6 + flame * 6} ry={10 + flame * 22} fill={`hsl(28 100% 60% / ${0.18 * flame})`} />}
        <LanderSvg variant={variant} flame={flame} crashed={crashed} />
      </g>
      {touch > 0 && landed && !calm && (
        <g key={`l${touch}`}>
          <ellipse cx="400" cy={GROUND + 3} rx="40" ry="5" fill="none" stroke="hsl(186 92% 56%)" strokeWidth="1.5">
            <animate attributeName="rx" from="30" to="140" dur="1.1s" fill="freeze" />
            <animate attributeName="opacity" from=".9" to="0" dur="1.1s" fill="freeze" />
          </ellipse>
          <ellipse cx="400" cy={GROUND + 2} rx="60" ry="7" fill="hsl(30 10% 76% / .35)">
            <animate attributeName="rx" from="50" to="150" dur="1.6s" fill="freeze" />
            <animate attributeName="opacity" from="1" to="0" dur="1.6s" fill="freeze" />
          </ellipse>
        </g>
      )}
      {crashed && <g><circle cx="410" cy="292" r="40" fill="hsl(20 90% 50% / .25)" /><path d="M370 296 L360 278 M450 294 L466 276 M405 286 L400 262" stroke="hsl(30 10% 70%)" strokeWidth="2" /></g>}
      {touch > 0 && crashed && !calm && (
        <circle key={`c${touch}`} cx="410" cy="292" r="40" fill="none" stroke="hsl(356 78% 58%)" strokeWidth="2">
          <animate attributeName="r" from="20" to="120" dur=".9s" fill="freeze" />
          <animate attributeName="opacity" from="1" to="0" dur=".9s" fill="freeze" />
        </circle>
      )}
    </svg>
  );
}
