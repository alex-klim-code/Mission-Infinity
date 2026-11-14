import type { CompatibilityIssue } from "@workspace/api-zod";

type Part={id:string;name:string;fuel?:{status:string;systems:string[][]}|null};
function systems(part:Part) {
  const fuel=part.fuel;
  return fuel?.status==="documented"&&fuel.systems.length&&fuel.systems.every(s=>s.length&&s.every(v=>v.trim()))
    ?fuel.systems:null;
}

/** Only the main-engine/main-tank connection is defined by this training model.
 * Unknown chemistry and dedicated upper-stage/lunar/electric supplies are NOT conflicts. */
export function mainPropellantIssue(engine?:Part,tank?:Part):CompatibilityIssue|null {
  if(!engine||!tank)return null;
  const required=systems(engine),supplied=systems(tank);
  if(!required||!supplied||required.some(a=>supplied.some(b=>a.length===b.length&&a.every(v=>b.includes(v)))))return null;
  return {
    id:`main-propellant:${engine.id}:${tank.id}`,title:"Main engine / tank propellant mismatch",
    message:`${engine.name} and ${tank.name} specify different propellant systems. In this training model, the selected main tank must supply the main engine. This combination will fail propulsion integration. Choose another engine or tank, or explicitly accept this risk.`,
    categoryIds:["main-engines","fuel-tanks"],optionIds:[engine.id,tank.id],repairCategoryId:"fuel-tanks",alternatives:[],source:"GAME_RULE",
  };
}
