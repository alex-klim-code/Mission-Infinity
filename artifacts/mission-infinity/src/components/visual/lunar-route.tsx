import { useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useCalm } from '@/components/session/rocket-shared';
import { useSceneActive } from './scene-active';

/** Decorative Earth-to-Moon transfer graphic built from the game's existing photographs. */
export function LunarRoute({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const calm = useCalm();
  const active = useSceneActive(ref, !calm);
  const id = useId().replace(/:/g, '');
  return (
    <div ref={ref} className={cn('lunar-route pointer-events-none relative select-none', !active && 'scene-paused', className)} aria-hidden>
      <div className="absolute left-[4%] top-[38%] h-[46%] aspect-square overflow-hidden rounded-full shadow-[inset_-14px_-10px_28px_hsl(224_52%_4%)] ring-1 ring-ion/30">
        <svg viewBox="0 0 120 120" className="lr-rotate h-full w-full" fill="none">
          <defs>
            <radialGradient id={`earth${id}`} cx=".3" cy=".25"><stop stopColor="#287fa5"/><stop offset=".7" stopColor="#104c75"/><stop offset="1" stopColor="#061a32"/></radialGradient>
            <linearGradient id={`night${id}`}><stop offset=".3" stopColor="#020917" stopOpacity="0"/><stop offset="1" stopColor="#020917" stopOpacity=".9"/></linearGradient>
            <clipPath id={`globe${id}`}><circle cx="60" cy="60" r="58"/></clipPath>
          </defs>
          <g clipPath={`url(#globe${id})`}>
            <circle cx="60" cy="60" r="58" fill={`url(#earth${id})`}/>
            <path d="M21 20 42 13 51 21 48 32 40 34 36 47 25 43 18 33Z M34 49 47 47 56 56 54 72 47 84 44 100 36 86 39 72 31 60Z M64 24 78 19 94 27 101 42 90 45 80 37 72 41 66 35Z M69 43 82 44 88 58 81 75 74 82 68 63 62 53Z M89 83 105 82 110 93 98 99 90 94Z" fill="#5a9b8a" opacity=".85"/>
            <path d="M11 40Q48 20 100 45 M20 72Q67 93 112 67 M43 12Q71 32 100 25" stroke="#d8f0f5" strokeWidth="4" strokeLinecap="round" opacity=".22"/>
            <circle cx="60" cy="60" r="58" fill={`url(#night${id})`}/>
          </g>
          <circle cx="60" cy="60" r="58" stroke="#6de3f5" strokeOpacity=".6"/>
        </svg>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,transparent_45%,hsl(224_52%_4%/.85)_75%)]" />
      </div>
      <div className="absolute right-[4%] top-[4%] h-[42%] aspect-square overflow-hidden rounded-full shadow-[inset_-12px_-8px_24px_hsl(224_52%_4%)] ring-1 ring-white/15">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <defs><radialGradient id={`moon${id}`} cx=".3" cy=".25"><stop stopColor="#d1d2cd"/><stop offset=".7" stopColor="#858a8e"/><stop offset="1" stopColor="#303844"/></radialGradient></defs>
          <circle cx="60" cy="60" r="58" fill={`url(#moon${id})`}/>
          {[[35,30,11],[75,24,7],[58,53,16],[30,71,9],[84,73,12],[64,93,6],[94,44,4],[20,49,4]].map(([x,y,r])=><g key={`${x}-${y}`}><circle cx={x} cy={y} r={r} fill="#4c5962" opacity=".28"/><path d={`M${x-r*.7} ${y+r*.4}Q${x} ${y+r*1.2} ${x+r*.8} ${y+r*.2}`} stroke="#e8e7dc" strokeWidth="1.4" opacity=".35" fill="none"/></g>)}
        </svg>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,transparent_40%,hsl(224_52%_4%/.9)_78%)]" />
      </div>
      <svg viewBox="0 0 300 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lr${id}`} x1="0" x2="1"><stop offset="0" stopColor="hsl(186 92% 56%)" /><stop offset="1" stopColor="hsl(22 96% 58%)" /></linearGradient>
        </defs>
        <path d="M58 98 C110 150 210 120 248 40" fill="none" stroke="hsl(210 60% 80% / .18)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <path className="lr-trace" d="M58 98 C110 150 210 120 248 40" fill="none" stroke={`url(#lr${id})`} strokeWidth="1.6" pathLength={100} strokeDasharray="18 82" vectorEffect="non-scaling-stroke" />
        <circle cx="248" cy="40" r="3" fill="hsl(22 96% 58%)" />
      </svg>
      <span className="absolute bottom-[6%] left-[6%] font-mono text-[9px] uppercase tracking-[.25em] text-ion/80">TLI</span>
      <span className="absolute right-[8%] top-[48%] font-mono text-[9px] uppercase tracking-[.25em] text-burn/80">LOI</span>
    </div>
  );
}
