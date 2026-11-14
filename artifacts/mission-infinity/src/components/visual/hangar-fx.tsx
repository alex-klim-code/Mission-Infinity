import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useCalm } from '@/components/session/rocket-shared';
import { useSceneActive } from './scene-active';

const SPARKS = [-14, -6, 4, 11, 18, -20];

/** Decorative hangar layer: gantry, crane, lights, welding sparks. Animates only while running and visible. */
export function HangarFx({ running, progress, failed }: { running: boolean; progress: number; failed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const calm = useCalm();
  const active = useSceneActive(ref, running && !calm);
  return (
    <div ref={ref} className={cn('hangar-fx pointer-events-none absolute inset-0', !active && 'scene-paused')} aria-hidden>
      <img src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/images/headquarters.png`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.12] mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-transparent to-void/90" />
      <div className="hg-haze absolute -inset-x-10 top-[30%] h-24 rounded-full bg-ion/10 blur-3xl" />
      {/* overhead crane rail + trolley */}
      <div className="absolute inset-x-4 top-9 h-1.5 rounded-sm border-y border-white/15 bg-white/[.04]" />
      <div className="hg-trolley absolute left-[30%] top-9" style={{ ['--span' as string]: '90px' }}>
        <div className="h-3 w-8 rounded-sm bg-burn/70" />
        <div className="mx-auto h-16 w-px bg-white/30" />
        <div className="mx-auto h-2 w-4 rounded-b-sm border border-white/30" />
      </div>
      {/* gantry tower */}
      <svg viewBox="0 0 40 300" preserveAspectRatio="none" className="absolute bottom-8 right-[calc(12%+7.5rem)] h-[80%] w-8">
        <path d="M4 0 V300 M36 0 V300" stroke="hsl(210 40% 70% / .35)" strokeWidth="1.5" />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M4 ${i * 20} L36 ${i * 20 + 20} M36 ${i * 20} L4 ${i * 20 + 20}`} stroke="hsl(210 40% 70% / .16)" strokeWidth="1" />)}
      </svg>
      {/* floor lights */}
      <div className="absolute inset-x-0 bottom-3 flex justify-around px-6">
        {Array.from({ length: 9 }, (_, i) => <span key={i} className={cn('h-1 w-1 rounded-full', failed ? 'bg-destructive/70' : 'bg-ion/60', running && 'hg-beacon')} style={{ animationDelay: `${i * 0.2}s` }} />)}
      </div>
      <span className={cn('absolute right-4 top-4 h-2 w-2 rounded-full', failed ? 'bg-destructive' : running ? 'bg-burn hg-beacon' : 'bg-white/25')} />
      {/* welding sparks follow the build line */}
      {active && (
        <div className="absolute w-0" style={{ right: 'calc(12% + 3.5rem)', bottom: `calc(2rem + ${Math.min(1, progress) * 78}%)` }}>
          {SPARKS.map((dx, i) => <span key={i} className="hg-spark" style={{ ['--dx' as string]: `${dx}px`, animationDelay: `${i * 0.18}s` }} />)}
        </div>
      )}
    </div>
  );
}
