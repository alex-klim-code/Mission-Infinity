import type { MissionSelectedComponent } from '@workspace/api-client-react';

export const pickComp = (list: MissionSelectedComponent[], re: RegExp) => list.find((c) => re.test(c.categoryId) || re.test(c.name));
/** Exact categoryId first; regex fallback only when that category is absent. */
export const comp = (list: MissionSelectedComponent[], id: string, re: RegExp) => list.find((c) => c.categoryId === id) ?? pickComp(list, re);
export const CAT = {
  lander: ['lunar-lander', /lander/i], legs: ['landing-legs', /landing.?leg/i], descent: ['lunar-descent-engine', /descent/i],
  shield: ['re-entry-heat-shield', /re-?entry|heat.?shield/i], recovery: ['recovery-system', /parachute|recover/i], capsule: ['return-capsule', /capsule/i],
} as const;
export const compOf = (list: MissionSelectedComponent[], k: keyof typeof CAT) => comp(list, CAT[k][0], CAT[k][1]);

export type LanderVariant = 'quad' | 'tri' | 'squat';
export function landerVariant(name?: string): LanderVariant {
  if (!name) return 'quad';
  const h = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (['quad', 'tri', 'squat'] as const)[h % 3];
}

/** Lander drawn around (0,0) = engine bell exit. Height ~60 units. */
export function LanderSvg({ variant, flame, crashed }: { variant: LanderVariant; flame: number; crashed?: boolean }) {
  const body = variant === 'squat' ? 'M-22 -34 L22 -34 L26 -14 L-26 -14 Z' : variant === 'tri' ? 'M-14 -50 L14 -50 L22 -14 L-22 -14 Z' : 'M-18 -44 L18 -44 L20 -14 L-20 -14 Z';
  const legs = variant === 'tri'
    ? ['M-18 -18 L-34 8', 'M18 -18 L34 8', 'M0 -16 L0 8']
    : ['M-18 -18 L-36 8', 'M18 -18 L36 8', 'M-10 -16 L-20 8', 'M10 -16 L20 8'];
  return (
    <g transform={crashed ? 'rotate(38) translate(6 10)' : undefined}>
      {flame > 0.02 && (
        <g>
          <path d={`M-7 0 Q0 ${10 + flame * 46} 7 0 Z`} fill="hsl(28 100% 58% / .85)" />
          <path d={`M-3.5 0 Q0 ${6 + flame * 26} 3.5 0 Z`} fill="hsl(48 100% 85%)" />
        </g>
      )}
      {legs.map((d) => <path key={d} d={d} stroke="hsl(210 20% 75%)" strokeWidth="2.2" fill="none" />)}
      {legs.map((d) => { const m = d.match(/L(-?\d+) (\d+)/)!; return <rect key={'f' + d} x={+m[1] - 4} y={+m[2] - 1} width="8" height="2.5" rx="1" fill="hsl(210 20% 80%)" />; })}
      <path d="M-8 -14 L-6 0 L6 0 L8 -14 Z" fill="hsl(220 10% 35%)" />
      <path d={body} fill="hsl(44 80% 52%)" stroke="hsl(44 60% 30%)" strokeWidth="1" />
      <path d={body} fill="url(#foil)" opacity=".5" />
      <rect x="-10" y={variant === 'squat' ? -46 : variant === 'tri' ? -62 : -56} width="20" height="12" rx="3" fill="hsl(210 15% 88%)" />
      <circle cx="0" cy={variant === 'squat' ? -40 : variant === 'tri' ? -56 : -50} r="3" fill="hsl(186 92% 56%)" />
      <defs><linearGradient id="foil" x1="0" x2="1"><stop offset="0" stopColor="white" stopOpacity=".6" /><stop offset=".5" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity=".4" /></linearGradient></defs>
    </g>
  );
}

export function Warn({ children, testid }: { children: React.ReactNode; testid: string }) {
  return <li className="rounded-sm border border-[hsl(44_95%_60%/.4)] bg-[hsl(44_95%_60%/.08)] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-[hsl(44_95%_70%)]" data-testid={testid}>{children}</li>;
}
