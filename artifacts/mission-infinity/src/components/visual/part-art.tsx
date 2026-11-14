import { useId } from 'react';
import { cn } from '@/lib/utils';

export type PartKind = 'engine' | 'tank' | 'computer' | 'navigation' | 'solar' | 'comms' | 'lander' | 'capsule' | 'structure' | 'body';

const KINDS: [RegExp, PartKind][] = [
  [/body|hull/i, 'body'],
  [/engine|thrust|motor|propuls/i, 'engine'],
  [/tank|fuel|propellant|oxidi/i, 'tank'],
  [/land|leg|lander/i, 'lander'],
  [/sample|capsule|return|recover|parachute|payload/i, 'capsule'],
  [/guidance|navig|gyro|imu|attitude|sensor|radar|star/i, 'navigation'],
  [/computer|avionic|flight control|processor/i, 'computer'],
  [/solar|power|battery|electr/i, 'solar'],
  [/comm|antenna|radio|transmit|telemetry/i, 'comms'],
];
export const partKind = (c: { id: string; name: string }): PartKind =>
  KINDS.find(([r]) => r.test(c.id) || r.test(c.name))?.[1] ?? 'structure';

const ION = 'hsl(186 92% 56%)';
const BURN = 'hsl(22 96% 58%)';
const LINE = 'hsl(200 50% 82% / .75)';

/** Schematic line illustration of a subsystem. Generic engineering drawing, not a manufacturer image. */
export function PartArt({ kind, className, live = false }: { kind: PartKind; className?: string; live?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const m = `pm${uid}`, g = `pg${uid}`, h = `ph${uid}`;
  const s = { stroke: LINE, strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const fillM = `url(#${m})`;
  return (
    <svg viewBox="0 0 120 80" fill="none" className={cn('part-art pointer-events-none', live && 'part-art-live', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={m} x1="0" x2="1">
          <stop offset="0" stopColor="hsl(214 30% 22%)" /><stop offset=".45" stopColor="hsl(206 30% 46%)" /><stop offset="1" stopColor="hsl(218 34% 16%)" />
        </linearGradient>
        <radialGradient id={g}><stop offset="0" stopColor={BURN} stopOpacity=".9" /><stop offset="1" stopColor={BURN} stopOpacity="0" /></radialGradient>
        <linearGradient id={h} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ION} stopOpacity=".35" /><stop offset="1" stopColor={ION} stopOpacity="0" /></linearGradient>
      </defs>
      <g stroke="hsl(186 92% 56% / .12)" strokeWidth=".5">{[20, 40, 60].map((y) => <line key={y} x1="4" x2="116" y1={y} y2={y} />)}{[30, 60, 90].map((x) => <line key={x} y1="4" y2="76" x1={x} x2={x} />)}</g>
      {kind === 'engine' && <g>
        <ellipse className="pa-glow" cx="60" cy="72" rx="20" ry="6" fill={`url(#${g})`} />
        <rect x="48" y="8" width="24" height="14" rx="2" fill={fillM} {...s} />
        <path d="M52 22 L68 22 L66 32 L54 32 Z" fill={fillM} {...s} />
        <path d="M55 32 C50 46 42 58 38 68 L82 68 C78 58 70 46 65 32 Z" fill={fillM} {...s} />
        {[44, 52, 60].map((y, i) => <path key={y} d={`M${46 - i * 2 + 8} ${y} Q60 ${y + 3} ${74 + i * 2 - 8} ${y}`} {...s} strokeWidth=".8" />)}
        <path d="M72 14 h10 v20 h-6" {...s} strokeWidth=".9" stroke={ION} />
      </g>}
      {kind === 'tank' && <g>
        <rect x="34" y="8" width="52" height="64" rx="24" fill={fillM} {...s} />
        <rect className="pa-fill" x="38" y="40" width="44" height="28" rx="4" fill={`url(#${h})`} />
        {[24, 40, 56].map((y) => <line key={y} x1="35" x2="85" y1={y} y2={y} {...s} strokeWidth=".7" />)}
        <path d="M60 8 V2 M86 40 h12 v26" {...s} stroke={ION} />
        <rect x="26" y="30" width="6" height="20" rx="1" {...s} />
      </g>}
      {kind === 'computer' && <g>
        <rect x="26" y="14" width="68" height="52" rx="3" fill={fillM} {...s} />
        <rect x="46" y="28" width="28" height="24" rx="2" fill="hsl(224 52% 6%)" {...s} stroke={ION} />
        {[32, 38, 44, 50].map((y) => <g key={y}><line x1="38" x2="46" y1={y} y2={y} {...s} strokeWidth=".8" /><line x1="74" x2="82" y1={y} y2={y} {...s} strokeWidth=".8" /></g>)}
        <circle className="pa-blink" cx="86" cy="20" r="2" fill={BURN} />
        <path d="M54 36 h12 M54 42 h8 M54 46 h10" stroke={ION} strokeWidth="1" />
      </g>}
      {kind === 'navigation' && <g>
        <circle cx="60" cy="40" r="26" fill={fillM} {...s} />
        <ellipse cx="60" cy="40" rx="26" ry="9" {...s} stroke={ION} />
        <ellipse className="pa-spin" cx="60" cy="40" rx="9" ry="26" {...s} style={{ transformOrigin: '60px 40px' }} />
        <circle cx="60" cy="40" r="4" fill={BURN} />
        <path d="M20 12 l3 3 m0 -3 l-3 3 M98 66 l3 3 m0 -3 l-3 3" stroke={ION} strokeWidth="1" />
      </g>}
      {kind === 'solar' && <g>
        <rect x="54" y="30" width="12" height="20" rx="2" fill={fillM} {...s} />
        {[8, 80].map((x) => <g key={x}><rect x={x} y="24" width="32" height="32" fill="hsl(214 60% 24%)" {...s} />
          {[1, 2, 3].map((k) => <line key={k} x1={x + k * 8} x2={x + k * 8} y1="24" y2="56" stroke={ION} strokeOpacity=".5" strokeWidth=".6" />)}
          <line x1={x} x2={x + 32} y1="40" y2="40" stroke={ION} strokeOpacity=".5" strokeWidth=".6" /></g>)}
        <path d="M40 40 h14 M66 40 h14" {...s} />
        <rect className="pa-sheen" x="8" y="24" width="10" height="32" fill="hsl(0 0% 100% / .18)" />
      </g>}
      {kind === 'comms' && <g>
        <path d="M30 22 Q60 64 90 22 Z" fill={fillM} {...s} />
        <path d="M60 44 L60 64 M48 70 h24 M60 44 L72 26" {...s} />
        <circle cx="72" cy="26" r="2.5" fill={BURN} />
        {[8, 14, 20].map((r) => <path key={r} className="pa-wave" d={`M${78 + r * .4} ${20 - r * .7} a${r} ${r} 0 0 1 ${r * .8} ${r * .8}`} {...s} stroke={ION} strokeWidth="1" />)}
      </g>}
      {kind === 'lander' && <g>
        <path d="M44 20 h32 l6 20 h-44 z" fill={fillM} {...s} />
        <rect x="50" y="10" width="20" height="10" rx="2" {...s} />
        <path d="M40 40 L24 66 M80 40 L96 66 M50 40 L44 66 M70 40 L76 66" {...s} />
        <path d="M18 66 h12 M90 66 h12 M40 66 h8 M72 66 h8" {...s} stroke={ION} />
        <path d="M54 40 L52 48 h16 L66 40" {...s} />
        <path d="M8 72 Q60 68 112 72" {...s} strokeWidth=".8" stroke="hsl(40 20% 60% / .6)" />
      </g>}
      {kind === 'capsule' && <g>
        <path d="M46 14 h28 l14 44 q-28 10 -56 0 z" fill={fillM} {...s} />
        <path d="M32 58 q28 14 56 0" {...s} stroke={BURN} strokeWidth="2" />
        <rect x="52" y="24" width="16" height="12" rx="2" fill="hsl(224 52% 6%)" {...s} stroke={ION} />
        <circle cx="60" cy="47" r="4" {...s} />
        <path d="M60 14 V6" {...s} />
      </g>}
      {kind === 'structure' && <g>
        <path d="M30 14 h60 l-8 52 h-44 z" fill={fillM} {...s} />
        <path d="M30 14 L82 66 M90 14 L38 66 M34 40 h52" {...s} strokeWidth=".9" stroke={ION} />
        {[[30, 14], [90, 14], [82, 66], [38, 66]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" fill={BURN} />)}
      </g>}
      {kind === 'body' && <g>
        <path d="M60 4 C70 14 72 26 72 34 L72 64 L78 74 L42 74 L48 64 L48 34 C48 26 50 14 60 4 Z" fill={fillM} {...s} />
        <line x1="48" x2="72" y1="34" y2="34" {...s} /><line x1="48" x2="72" y1="52" y2="52" {...s} />
      </g>}
    </svg>
  );
}
