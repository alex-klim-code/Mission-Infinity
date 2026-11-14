import type { RocketComponent } from '@workspace/api-client-react';
import { assessFuel, fuelDescription } from '@/lib/rocket-fuel';

/** Source omissions are not warnings. Dedicated stage/lander supplies aren't a main-tank connection. */
export function RocketFuelCheck({ parts, candidate }: { parts: RocketComponent[]; candidate?: RocketComponent }) {
  if(candidate&&!['main-engines','fuel-tanks'].includes(candidate.categoryId))return null;
  const conflicts=assessFuel(parts,candidate).comparisons.filter(pair=>
    pair.engine.categoryId==='main-engines'&&pair.status==='conflict'&&
    (!candidate||pair.engine.id===candidate.id||pair.tank.id===candidate.id));
  if(!conflicts.length)return null;
  return (
    <section className="my-3 space-y-2 rounded-md border border-burn/30 bg-burn/5 p-3 text-xs [overflow-wrap:anywhere]" aria-label="Main propulsion compatibility" data-testid={candidate?'panel-option-fuel':'panel-design-fuel'}>
      <h3 className="font-semibold text-burn">Main engine / tank propellant mismatch</h3>
      {conflicts.map(pair=><p key={`${pair.engine.id}:${pair.tank.id}`}>{pair.engine.name} requires {fuelDescription(pair.engine)}; {pair.tank.name} specifies {fuelDescription(pair.tank)}. In this training model, the main tank must supply the main engine.</p>)}
      <p>Purchase will ask you to review and explicitly accept this incompatibility. No money is charged before confirmation.</p>
    </section>
  );
}
