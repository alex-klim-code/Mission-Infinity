import { createHash, randomInt } from "node:crypto";
import type { MissionFlightPlan, MissionWeather, InstrumentDiagnostic, MissionFlightTelemetry } from "@workspace/api-zod";
import { componentById } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";
import { returnFuelRequirement } from "./lunar-operations-model";

export const CONSTRUCTION_MS = 10000;
export const FLIGHT_MS = 20000;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const round = (n: number) => Math.round(n * 100) / 100;

/** Piecewise interpolation through the user's table; round up to a whole month. */
export function constructionMonths(cost: number) {
  const points = [[50000000,12],[100000000,15],[150000000,18],[200000000,22],[250000000,26],[300000000,30],[350000000,33],[400000000,36]];
  if (cost <= points[0][0]) return 12;
  for (let i = 1; i < points.length; i++) {
    const [x,y] = points[i], [px,py] = points[i-1];
    if (cost <= x) return Math.ceil(py + (cost-px)/(x-px)*(y-py));
  }
  return 36;
}

/** Configuration value, not historical ledger balance: identical designs take
 * identical time even if an older save bought its hull before repricing. */
export function rocketDesignCost(hullId: string | null, selections: Record<string,string>) {
  return (hullId ? componentById.get(hullId)?.price ?? 0 : 0) +
    Object.entries(selections).filter(([category])=>category!=="rocket-body")
      .reduce((sum,[,id])=>sum+(componentById.get(id)?.price??0),0);
}

export function missionWeather(sessionId: string, today: string): MissionWeather[] {
  const conditions: MissionWeather["condition"][] = ["SUNNY","PARTLY_CLOUDY","CLOUDY","RAIN","STRONG_WIND","STORM"];
  return Array.from({length:28}, (_,i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate()+i);
    const date = d.toISOString().slice(0,10);
    const value = createHash("sha256").update(`${sessionId}:${date}:weather`).digest()[0];
    return {date, condition:conditions[value % conditions.length]};
  });
}

/**
 * Calibrated educational model, NOT real vehicle performance. Catalog does not
 * supply complete hull mass, engine counts, Isp or connections. Every missing
 * quantity is disclosed, never passed off as a manufacturer specification.
 */
export function makeFlightPlan(hullId: string, selections: Record<string,string>, instrumentIds: string[], fuelLoadedKg: number): MissionFlightPlan {
  const parts = Object.values(selections).flatMap(id => componentById.has(id) ? [componentById.get(id)!] : []);
  const main = componentById.get(selections["main-engines"]);
  const upper = componentById.get(selections["upper-stage-engines"]);
  const engineCategories = new Set(["main-engines","upper-stage-engines","orbital-maneuvering","lunar-descent-engine","lunar-ascent-system"]);
  const engines = parts.filter(p => engineCategories.has(p.categoryId));
  const hullMass = hullId === "nova-prime" ? 22000 : hullId === "titan-explorer" ? 16000 : 12000;
  const dryMassKg = round(hullMass + parts.reduce((sum,p) => sum + (p.massKg ?? 100),0) +
    scientificInstruments.filter(i=>instrumentIds.includes(i.id)).reduce((sum,i)=>sum+i.massKg,0));
  const score = (main?.quality ?? 60)*0.6 + (upper?.quality ?? 60)*0.4;
  const specificImpulseSeconds = round(260+score*1.3);
  const thrustN = Math.round(250000+score*12000);
  const initialMassKg = dryMassKg+fuelLoadedKg;
  const ve = specificImpulseSeconds*9.80665;
  // Fixed route maneuvers; separate departure/insertion burns, no coast debit.
  const departureFuelKg = round(initialMassKg*(1-Math.exp(-1800/ve)));
  const arrivalFuelKg = round((initialMassKg-departureFuelKg)*(1-Math.exp(-400/ve)));
  const requiredOutboundKg = round(departureFuelKg+arrivalFuelKg);
  const requiredReturnKg = round(returnFuelRequirement(selections,Math.max(0,fuelLoadedKg-requiredOutboundKg),specificImpulseSeconds));
  const availableDeltaV = ve*Math.log(initialMassKg/dryMassKg);
  const acceleration = thrustN/initialMassKg;
  const cruiseKmPerSecond = clamp(Math.min(1800, availableDeltaV)/1000 * 0.72 + Math.min(acceleration,40)*0.006,0.4,1.6);
  const outboundDays = round(clamp(384400/cruiseKmPerSecond/86400,3,12));
  const returnDays = round(outboundDays*0.94);
  return {
    routeId:"earth-moon-earth", routeLabel:"Earth → Moon → Earth", distanceKm:384400,
    outboundDays, returnDays, totalDays:round(outboundDays+returnDays+7),
    dryMassKg, initialMassKg, engineCount:engines.length, engineNames:engines.map(e=>e.name),
    thrustN, specificImpulseSeconds, fuelLoadedKg, departureFuelKg, arrivalFuelKg,
    requiredOutboundKg, requiredReturnKg, requiredFuelKg:round(requiredOutboundKg+requiredReturnKg),
    massAssumed:true, animationDurationMs:FLIGHT_MS,
    assumptions:"Educational gameplay model, not an orbital simulator or certified launch prediction. Fixed Earth–Moon–Earth route: 384,400 km per leg plus 7 days of lunar operations. One unit per selected engine category; hull dry mass 12,000 / 16,000 / 22,000 kg and 100 kg per part without mass data. Effective thrust and specific impulse are gameplay values derived from selected main/upper engine quality. Rocket-equation mass ratio, loaded propellant and acceleration determine the estimate. Return calculations leave the heavy launch stages and descent lander behind, carrying the selected return hardware plus a 500 kg service allowance; ascent quality affects the modeled return burn. Lunar descent and collected samples update the final departure requirement. Burn rates use accelerated animation time; no fuel is consumed while coasting. All phases share the paid propellant reserve; no free refill.",
  };
}

/** Pure server-clock telemetry, repeatable on reads/reloads; never edits paid fuel. */
export function flightTelemetry(plan: MissionFlightPlan | null, startedAt: Date | null, now = Date.now()): MissionFlightTelemetry {
  const base: MissionFlightTelemetry = {progress:0,currentDay:1,remainingFuelKg:plan?.fuelLoadedKg ?? 0,consumptionKgPerSecond:0,speedKmPerSecond:0,massKg:plan?.initialMassKg ?? 0,maneuver:"PAD",startedAt:startedAt?.toISOString() ?? null};
  if (!plan || !startedAt) return base;
  let p = clamp((now-startedAt.getTime())/plan.animationDurationMs,0,1);
  const departure = plan.departureFuelKg;
  const arrival = plan.arrivalFuelKg;
  const fuel = plan.fuelLoadedKg;
  const failureAt = fuel < departure ? fuel/Math.max(1,departure)*0.2 :
    fuel < departure+arrival ? 0.85+(fuel-departure)/Math.max(1,arrival)*0.15 : null;
  const failed = failureAt !== null && p >= failureAt;
  if (failed) p = failureAt!;
  const used = Math.min(fuel, departure*clamp(p/0.2,0,1)+arrival*clamp((p-0.85)/0.15,0,1));
  const maneuver = failed ? "FAILED" : p >= 1 ? "COMPLETE" : p < 0.2 ? "LAUNCH_BURN" : p < 0.85 ? "COAST" : "LUNAR_INSERTION";
  const cruise = plan.distanceKm/(plan.outboundDays*86400);
  return {
    ...base, progress:p, currentDay:Math.max(1,Math.ceil(plan.outboundDays*p)), remainingFuelKg:round(Math.max(0,fuel-used)),
    consumptionKgPerSecond:maneuver==="LAUNCH_BURN" ? round(departure/(plan.animationDurationMs/1000*0.2)) :
      maneuver==="LUNAR_INSERTION" ? round(arrival/(plan.animationDurationMs/1000*0.15)) : 0,
    speedKmPerSecond:round(failed ? 0 : p<0.2 ? cruise*(p/0.2) : p>0.85 ? cruise*(1-(p-0.85)/0.15)*0.8 : cruise),
    massKg:round(plan.dryMassKg+fuel-used), maneuver,
  };
}

export function failureProbability(quality: number) {
  return quality >= 90 ? 0.03 : quality >= 80 ? 0.07 : quality >= 70 ? 0.12 : quality >= 60 ? 0.20 : quality >= 40 ? 0.30 : 0.45;
}
const faults: Record<string,string> = {
  "panchromatic-camera":"Lens damage reduced image detail.",
  "multispectral-camera":"Sensor failure reduced spectral coverage.",
  "lunar-magnetometer":"Calibration drift reduced magnetic-field accuracy.",
  "radiation-detector":"Detector damage reduced radiation data collection.",
  "lunar-spectrometer":"Optical damage limited mineral analysis.",
  "subsurface-radar":"Antenna failure reduced subsurface measurements.",
  "advanced-sample-analyzer":"Sample mechanism failure limited material analysis.",
};
export function drawDiagnostics(ids: string[], random = () => randomInt(0,1000000)/1000000): InstrumentDiagnostic[] {
  return scientificInstruments.filter(i=>ids.includes(i.id)).map(i=>{
    const failed = random()<failureProbability(i.quality);
    // Conditional severity is explicit game balance: 70% damaged, 30% critical.
    const status = !failed ? "OPERATIONAL" : random()<0.7 ? "DAMAGED" : "CRITICAL_FAILURE";
    return {instrumentId:i.id,name:i.name,quality:i.quality,status,maxSciencePoints:i.maxSciencePoints,
      availableSciencePoints:status==="OPERATIONAL" ? i.maxSciencePoints : status==="DAMAGED" ? i.maxSciencePoints/2 : 0,
      failure:failed ? faults[i.id] ?? "Instrument subsystem failure." : null,progress:1};
  });
}
