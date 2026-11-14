import React from 'react';
import type { ScienceScoring } from '@workspace/api-client-react';

const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function ScienceForecast({ points, rules }: { points: number; rules?: ScienceScoring }) {
  if (!rules || rules.maxSciencePoints <= 0 || rules.totalMissionWeight <= 0) {
    return <p className="mt-3 text-xs text-muted-foreground" data-testid="text-science-forecast-unavailable">Stage 8 forecast unavailable: scoring rules could not be loaded. Refresh to try again.</p>;
  }
  const completion = Math.max(0, Math.min(1, points / rules.maxSciencePoints));
  const maxContribution = rules.objectiveWeight / rules.totalMissionWeight * 100;
  return (
    <section className="mt-3 space-y-2 rounded-md border border-ion/25 bg-ion/[.04] p-3 text-xs" aria-label="Stage 8 science forecast" data-testid="panel-science-forecast">
      <h2 className="font-mono text-[11px] uppercase tracking-widest text-ion">Stage 8 / Maximum science potential</h2>
      <p data-testid="text-science-forecast-objective">
        <strong>{number(completion * 100)}%</strong> of the science objective
        {' '}({number(points)} / {number(rules.maxSciencePoints)} Science Points).
      </p>
      <p data-testid="text-science-forecast-contribution">
        Up to <strong className="text-ion">{number(completion * maxContribution)} percentage points</strong> toward the final mission score.
        {' '}The full science objective is worth {number(maxContribution)} percentage points.
      </p>
      <p className="text-muted-foreground">
        Maximum potential, not a guaranteed result: assumes every selected instrument works at full capacity and research succeeds at all three locations.
        Damage, failures and incomplete research can reduce earned points. Sample collection, safe return and recovery are scored separately in Stage 8.
        Equipment credited from Stage 1 adds no Science Points.
      </p>
      <p className="text-[10px] text-muted-foreground">Approximate values; Stage 8 rounds the combined mission score to a whole percent.</p>
    </section>
  );
}
