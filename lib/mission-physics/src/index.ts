/** Strict specification solver; the game uses the quality-based helper exported below. */
export { assessGameplayPayload } from "./gameplay";
export const G0 = 9.81;
export const ENGINE_CATEGORIES = new Set(["main-engines", "upper-stage-engines", "orbital-maneuvering", "lunar-descent-engine", "lunar-ascent-system"]);
const PAYLOAD_CATEGORIES = new Set(["sample-collection", "sample-container", "scientific-instruments"]);
export interface PhysicalComponent {
  id: string; categoryId: string; name: string; massKg: number | null;
  thrustN?: number | null; specificImpulseSeconds?: number | null;
  quality?: number | null;
}
export interface PayloadStage {
  id: string;
  componentCategoryIds: string[];
  /** Which of this stage's selected engines ignite together. */
  engineCategoryIds: string[];
  /** Documented allocation of the player's actual loaded propellant. */
  fuelFraction: number;
}
export interface PayloadBurn {
  id: string; stageId: string;
  phase: "LAUNCH" | "OUTBOUND" | "LUNAR_LANDING" | "EARTH_RETURN";
  requiredDeltaVMps: number;
  separateStageIds: string[];
}
export interface PayloadProfile {
  /** Citation identifying the source of stage assignments and mission requirements. */
  source: string;
  stages: PayloadStage[];
  burns: PayloadBurn[];
}
export interface PayloadInput {
  components: PhysicalComponent[];
  instruments: { id: string; massKg: number | null }[];
  fuelKg: number | null;
  profile?: PayloadProfile | null;
}
export type PayloadWarning = "OVERWEIGHT" | "INSUFFICIENT THRUST" | "INSUFFICIENT DELTA-V" | "INSUFFICIENT RETURN FUEL";
export interface BurnAssessment {
  id: string; stageId: string; phase: PayloadBurn["phase"];
  initialMassKg: number; finalMassKg: number; consumedFuelKg: number;
  availableDeltaVMps: number; requiredDeltaVMps: number;
}
export interface PayloadAssessment {
  basis?: "QUALITY" | "SPECIFICATIONS";
  referenceFuelKg?: number;
  fuelIsEstimate?: boolean;
  status: "COMPLETE" | "INCOMPLETE"; feasible: boolean | null;
  maximumPayloadKg: number | null; currentPayloadKg: number | null;
  remainingPayloadKg: number | null; totalMassKg: number | null;
  totalThrustN: number | null; launchThrustN: number | null; launchTwr: number | null;
  availableDeltaVMps: number | null; requiredDeltaVMps: number | null;
  requiredReturnFuelKg: number | null; availableReturnFuelKg: number | null;
  missingData: string[]; warnings: PayloadWarning[]; burns: BurnAssessment[];
}
const nonnegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const positive = (n: unknown): n is number => nonnegative(n) && n > 0;

/** Read only explicitly labelled, unit-bearing catalog values. Never infer Isp
 * from quality, thrust from an engine name, or missing mass from a price tier. */
export function engineSpecifications(parameters: string) {
  const thrust = /\bthrust\s*:\s*(\d+(?:\.\d+)?)\s*(kN|N)\b/i.exec(parameters)
    ?? /\b(\d+(?:\.\d+)?)\s*(kN|N)\s+thrust\b/i.exec(parameters);
  const isp = /\bIsp\s*:\s*(\d+(?:\.\d+)?)\s*s\b/i.exec(parameters);
  return {
    thrustN: thrust ? Number(thrust[1]) * (thrust[2].toLowerCase() === "kn" ? 1000 : 1) : null,
    specificImpulseSeconds: isp ? Number(isp[1]) : null,
  };
}

export function assessPayload(input: PayloadInput): PayloadAssessment {
  const missing: string[] = [];
  const parts = [...new Map(input.components.map(p => [p.id, p])).values()];
  const instruments = [...new Map(input.instruments.map(p => [p.id, p])).values()];
  const payloadParts = parts.filter(p => PAYLOAD_CATEGORIES.has(p.categoryId));
  const payloadItems = [...payloadParts, ...instruments];
  for (const p of parts) if (!nonnegative(p.massKg)) missing.push(`${p.name}: dry mass (kg)`);
  for (const p of instruments) if (!nonnegative(p.massKg)) missing.push(`${p.id}: payload mass (kg)`);
  if (!parts.some(p => p.categoryId === "rocket-body")) missing.push("Rocket body");
  const engines = parts.filter(p => ENGINE_CATEGORIES.has(p.categoryId));
  if (!engines.length) missing.push("Selected engines");
  for (const p of engines) {
    if (!positive(p.thrustN)) missing.push(`${p.name}: thrust (N)`);
    if (!positive(p.specificImpulseSeconds)) missing.push(`${p.name}: Isp (s)`);
  }
  if (!nonnegative(input.fuelKg)) missing.push("Actual loaded fuel mass (kg)");
  const currentPayloadKg = payloadItems.every(p => nonnegative(p.massKg)) ? payloadItems.reduce((n, p) => n + p.massKg!, 0) : null;
  const totalMassKg = parts.every(p => nonnegative(p.massKg)) && instruments.every(p => nonnegative(p.massKg)) && nonnegative(input.fuelKg)
    ? parts.reduce((n,p) => n + p.massKg!, 0) + instruments.reduce((n,p) => n + p.massKg!, 0) + input.fuelKg : null;
  if (totalMassKg !== null && totalMassKg <= 0) missing.push("Positive total rocket mass");
  const totalThrustN = engines.length && engines.every(p => positive(p.thrustN)) ? engines.reduce((n,p) => n+p.thrustN!,0) : null;
  const profile = input.profile;
  if (!profile?.source?.trim() || !profile.stages?.length || !profile.burns?.length) missing.push("Documented stage allocation and LUNA maneuver delta-V requirements");
  if (profile?.stages?.length && profile.burns?.length) {
    const stages = profile.stages;
    if (new Set(stages.map(s => s.id)).size !== stages.length) missing.push("Unique stage IDs");
    if (stages.some(s => !nonnegative(s.fuelFraction) || s.fuelFraction > 1) ||
      Math.abs(stages.reduce((n,s) => n+s.fuelFraction,0)-1)>1e-9) missing.push("Fuel allocations totaling 100%");
    for (const p of parts.filter(p => !PAYLOAD_CATEGORIES.has(p.categoryId))) {
      if (stages.filter(s => s.componentCategoryIds.includes(p.categoryId)).length !== 1) missing.push(`${p.name}: unique stage assignment`);
    }
    const dropped = new Set<string>();
    const burnedEngines = new Set<string>();
    for (const b of profile.burns) {
      const stage = stages.find(s => s.id === b.stageId);
      if (!stage || dropped.has(b.stageId)) missing.push(`${b.id}: attached active stage`);
      if (!positive(b.requiredDeltaVMps)) missing.push(`${b.id}: required delta-V (m/s)`);
      if (stage) {
        if (!stage.engineCategoryIds.length) missing.push(`${stage.id}: active engines`);
        for (const category of stage.engineCategoryIds) {
          if (!ENGINE_CATEGORIES.has(category) || !stage.componentCategoryIds.includes(category) ||
            !engines.some(e => e.categoryId === category)) missing.push(`${stage.id}: selected ${category} engine assignment`);
          burnedEngines.add(category);
        }
      }
      for (const id of b.separateStageIds) {
        if (!stages.some(s => s.id === id) || dropped.has(id)) missing.push(`${b.id}: valid stage separation`);
        dropped.add(id);
      }
    }
    for (const e of engines) if (!burnedEngines.has(e.categoryId)) missing.push(`${e.name}: ignition schedule`);
    if (profile.burns[0].phase !== "LAUNCH" || !profile.burns.some(b => b.phase === "LUNAR_LANDING") || !profile.burns.some(b => b.phase === "EARTH_RETURN"))
      missing.push("Launch, lunar landing and Earth-return burn requirements");
  }
  const result: PayloadAssessment = {
    status:"INCOMPLETE",feasible:null,maximumPayloadKg:null,currentPayloadKg,remainingPayloadKg:null,totalMassKg,totalThrustN,
    launchThrustN:null,launchTwr:null,availableDeltaVMps:null,requiredDeltaVMps:null,
    requiredReturnFuelKg:null,availableReturnFuelKg:null,missingData:[...new Set(missing)],warnings:[],burns:[],
  };
  if (missing.length || !profile || currentPayloadKg === null || totalMassKg === null) return result;

  const staged = profile.stages.map(s => {
    const hardware = parts.filter(p => !PAYLOAD_CATEGORIES.has(p.categoryId) && s.componentCategoryIds.includes(p.categoryId));
    const activeEngines = engines.filter(p => s.engineCategoryIds.includes(p.categoryId));
    const thrust = activeEngines.reduce((n,p)=>n+p.thrustN!,0);
    // Effective exhaust velocity for simultaneously firing, unlike engines:
    // sum(thrust) / sum(mass flow), not an arithmetic average of Isp.
    const exhaustVelocity = thrust / activeEngines.reduce((n,p)=>n+p.thrustN!/(p.specificImpulseSeconds!*G0),0);
    return {id:s.id,dry:hardware.reduce((n,p)=>n+p.massKg!,0),fuel:input.fuelKg!*s.fuelFraction,thrust,exhaustVelocity};
  });
  function simulate(payload: number) {
    const stages = staged.map(s=>({...s,attached:true}));
    const mass = () => payload+stages.filter(s=>s.attached).reduce((n,s)=>n+s.dry+s.fuel,0);
    const launchThrust = stages.find(s=>s.id===profile!.burns[0].stageId)!.thrust;
    const twr = launchThrust/(mass()*G0);
    let achieved=0, deltaFailure=false, returnFailure=false, requiredReturn=0;
    let availableReturn: number | null=null;
    const burns: BurnAssessment[]=[];
    for (const b of profile!.burns) {
      const s=stages.find(s=>s.id===b.stageId)!;
      const initial=mass();
      if (b.phase==="EARTH_RETURN" && availableReturn===null) {
        const returnStages=new Set(profile!.burns.filter(b=>b.phase==="EARTH_RETURN").map(b=>b.stageId));
        availableReturn=stages.filter(s=>s.attached&&returnStages.has(s.id)).reduce((n,s)=>n+s.fuel,0);
      }
      const required=initial*(-Math.expm1(-b.requiredDeltaVMps/s.exhaustVelocity));
      const available=s.fuel < initial ? s.exhaustVelocity*Math.log(initial/(initial-s.fuel)) : Infinity;
      const shortage=required>s.fuel+1e-7;
      if (shortage) {deltaFailure=true;if(b.phase==="EARTH_RETURN")returnFailure=true;}
      if (b.phase==="EARTH_RETURN")requiredReturn+=required;
      const consumed=Math.min(required,s.fuel);
      achieved+=s.exhaustVelocity*Math.log(initial/(initial-consumed));
      s.fuel=Math.max(0,s.fuel-consumed);
      burns.push({id:b.id,stageId:b.stageId,phase:b.phase,initialMassKg:initial,finalMassKg:mass(),consumedFuelKg:consumed,availableDeltaVMps:available,requiredDeltaVMps:b.requiredDeltaVMps});
      for(const id of b.separateStageIds)stages.find(s=>s.id===id)!.attached=false;
    }
    const last=stages.find(s=>s.id===profile!.burns.at(-1)!.stageId)!;
    // Only fuel still attached after the final maneuver can provide a margin.
    const margin=last.attached&&last.fuel>0&&mass()>last.fuel ? last.exhaustVelocity*Math.log(mass()/(mass()-last.fuel)) : 0;
    return {feasible:twr>1&&!deltaFailure,twr,launchThrust,deltaFailure,returnFailure,requiredReturn,availableReturn:availableReturn??0,availableDeltaV:achieved+margin,burns};
  }
  const current=simulate(currentPayloadKg);
  let low=0;
  const zero=simulate(0);
  // Physical launch-TWR bound, not an arbitrary search ceiling or payload cap.
  let high=Math.max(0,zero.launchThrust/G0-(totalMassKg-currentPayloadKg));
  if (zero.feasible) for(let i=0;i<80;i++){
    const mid=(low+high)/2;
    if(simulate(mid).feasible)low=mid;else high=mid;
  }
  const maximum=Math.floor(low*1e6)/1e6;
  const warnings: PayloadWarning[]=[];
  if(currentPayloadKg>maximum+1e-5)warnings.push("OVERWEIGHT");
  if(current.twr<=1)warnings.push("INSUFFICIENT THRUST");
  if(current.deltaFailure)warnings.push("INSUFFICIENT DELTA-V");
  if(current.returnFailure)warnings.push("INSUFFICIENT RETURN FUEL");
  return {...result,status:"COMPLETE",feasible:current.feasible,maximumPayloadKg:maximum,remainingPayloadKg:maximum-currentPayloadKg,
    launchThrustN:current.launchThrust,launchTwr:current.twr,availableDeltaVMps:current.availableDeltaV,
    requiredDeltaVMps:profile.burns.reduce((n,b)=>n+b.requiredDeltaVMps,0),
    requiredReturnFuelKg:current.requiredReturn,availableReturnFuelKg:current.availableReturn,warnings,burns:current.burns};
}
