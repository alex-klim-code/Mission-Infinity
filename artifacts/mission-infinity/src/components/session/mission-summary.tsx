import type { Mission } from '@workspace/api-client-react';
import { formatBudget } from '@/lib/game';
import { cn } from '@/lib/utils';

export function missionDuration(m: Mission) {
  const w = m.operationalWeeks ?? 0;
  if (w > 0) return `${w} weeks`;
  return m.operationalYears > 0 ? `${m.operationalYears} years` : '';
}

export function missionFacts(m: Mission): [string, string][] {
  return [
    ['Total Budget', formatBudget(m.budget)],
    ['Difficulty', m.difficulty],
    ['Preparation Time', `${m.developmentMonths} months`],
    ['Mission Duration', missionDuration(m)],
  ].filter(([, v]) => !!v) as [string, string][];
}

export function MissionFacts({ mission, className, cellClass }: { mission: Mission; className?: string; cellClass?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10', className)} data-testid="list-mission-facts">
      {missionFacts(mission).map(([k, v]) => (
        <div key={k} className={cn('min-w-0 bg-void/85 p-3', cellClass)}>
          <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</dt>
          <dd className="mt-1 break-words font-display text-base font-semibold text-ion sm:text-lg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MissionSchedule({ mission, className }: { mission: Mission; className?: string }) {
  return (
    <div className={cn('space-y-5', className)} data-testid="panel-mission-schedule">
      {mission.briefing.map((b, i) => (
        <section key={i}>
          <h3 className="mb-1.5 flex items-baseline gap-3 font-display text-base font-bold uppercase tracking-wider">
            <span className="font-mono text-xs text-burn">{String(i + 1).padStart(2, '0')}</span>
            {b.title}
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{b.text}</p>
        </section>
      ))}
    </div>
  );
}

export function MissionSummary({ mission, className }: { mission: Mission; className?: string }) {
  return (
    <div className={cn('space-y-5', className)}>
      <MissionFacts mission={mission} className="sm:grid-cols-4" />
      <MissionSchedule mission={mission} />
    </div>
  );
}
