// Isolated archive of the pre-redesign landing page. No auth or API side effects.
import type { AnchorHTMLAttributes } from 'react';

export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} onClick={(event) => event.preventDefault()} />;
}

export function imgUrl(path: string) {
  return path.replace('/images/', '/__mockup/images/mission-landing-before/');
}

export function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
      <img src="/__mockup/images/mission-landing-before/logo.svg" alt="" className={small ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className="font-display text-sm font-bold uppercase tracking-[.22em]">
        Mission<span className="text-burn">:</span> Infinity
      </span>
    </Link>
  );
}

export function usePrefs() {
  return { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-md bg-white/[.04] ${className ?? ''}`}>
    <div className="sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ion/10 to-transparent" />
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div><p>{message}</p><button onClick={onRetry}>Retry transmission</button></div>;
}
export function errMsg(_error: unknown, fallback: string) { return fallback; }
export function formatBudget(b: number) { return `$${b / 1_000_000}M`; }

export interface Mission {
  id: string; number: string; title: string; subtitle: string; description: string;
  image: string; enabled: boolean; budget: number; developmentMonths: number;
  operationalYears: number; destination: string;
}
// Public catalog snapshot captured before redesign; not used by the real app.
const missions: Mission[] = [
  { id: 'earth-observer', number: '001', title: 'Earth Observer',
    subtitle: "Design and launch humanity's next Earth observation satellite.",
    description: 'You have been selected to lead your first independent space mission. Your objective is to develop an Earth observation satellite capable of collecting valuable environmental data from orbit.',
    image: '/images/earth-orbit.png', enabled: true, budget: 150000000,
    developmentMonths: 24, operationalYears: 3, destination: 'Low Earth Orbit' },
  { id: 'lunar-explorer', number: '002', title: 'Lunar Explorer',
    subtitle: 'Return to our nearest world.', description: 'Return to our nearest world.',
    image: '/images/lunar.png', enabled: false, budget: 0, developmentMonths: 0, operationalYears: 0, destination: 'The Moon' },
  { id: 'mars-orbiter', number: '003', title: 'Mars Orbiter',
    subtitle: 'A new perspective on the red planet.', description: 'A new perspective on the red planet.',
    image: '/images/mars.png', enabled: false, budget: 0, developmentMonths: 0, operationalYears: 0, destination: 'Mars Orbit' },
  { id: 'lunar-base', number: '004', title: 'Lunar Base',
    subtitle: 'Build the foundations of a new frontier.', description: 'Build the foundations of a new frontier.',
    image: '/images/lunar-base.png', enabled: false, budget: 0, developmentMonths: 0, operationalYears: 0, destination: 'Lunar Surface' },
];
export function useGetGameCatalog() {
  return { data: { missions }, isLoading: false, error: null, refetch: () => undefined };
}
