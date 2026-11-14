import type { RocketComponent } from '@workspace/api-client-react';
import { assessFuel, fuelCopy, fuelDescription, fuelRole } from '@/lib/rocket-fuel';

export function RocketFuelCheck({ parts, candidate }: { parts: RocketComponent[]; candidate?: RocketComponent }) {
  if (candidate && !fuelRole(candidate)) return null;
  const result = assessFuel(parts, candidate);
  const comparisons = candidate
    ? result.comparisons.filter(pair => pair.engine.id === candidate.id || pair.tank.id === candidate.id)
    : result.comparisons;
  const conflicts = comparisons.filter(pair => pair.status === 'conflict').length;
  const unverified = !comparisons.length || comparisons.some(pair => pair.status === 'unverified');
  return (
    <section className="my-3 space-y-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs [overflow-wrap:anywhere]" aria-label={fuelCopy.title} data-testid={candidate ? 'panel-option-fuel' : 'panel-design-fuel'}>
      <h3 className="font-semibold text-amber-200">{fuelCopy.title}: {conflicts ? `${fuelCopy.conflict} (${conflicts})` : unverified ? fuelCopy.unverified : fuelCopy.noConflict}</h3>
      {candidate && <p className="text-muted-foreground">{fuelCopy.preview}</p>}
      {candidate && (
        <dl className="space-y-1">
          <dt className="font-semibold">{fuelCopy.requirement}</dt>
          <dd>{fuelDescription(candidate)}</dd>
          {candidate.fuel?.sourceLocation && <><dt className="font-semibold">{fuelCopy.reference}</dt><dd>{candidate.fuel.sourceLocation} · {candidate.source}</dd></>}
        </dl>
      )}
      {!result.engines.length && <p>{result.tanks.length ? fuelCopy.noEngine : fuelCopy.empty}</p>}
      {!!result.engines.length && !result.tanks.length && <p>{fuelCopy.noTank}</p>}
      {/* Even without a counterpart, unknown chemistry must remain visible. */}
      {!comparisons.length && [...result.engines, ...result.tanks].filter(part => !candidate || part.id === candidate.id).map(part => (
        <p key={part.id}>{part.name}: {fuelDescription(part)}</p>
      ))}
      <ul className="space-y-2" aria-live="polite">
        {comparisons.map(pair => (
          <li key={`${pair.engine.id}:${pair.tank.id}`} className={pair.status === 'conflict' ? 'font-medium text-amber-200' : ''}>
            <p>{pair.engine.name} ↔ {pair.tank.name}</p>
            <p className="text-muted-foreground">{fuelDescription(pair.engine)} ↔ {fuelDescription(pair.tank)}</p>
            <p>{pair.status === 'conflict' ? fuelCopy.mismatch : pair.status === 'unverified' ? fuelCopy.missing : fuelCopy.match}</p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">{fuelCopy.scope}</p>
      <p className="text-muted-foreground">{fuelCopy.disclaimer}</p>
    </section>
  );
}
