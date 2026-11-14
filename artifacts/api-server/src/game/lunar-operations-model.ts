import type { InstrumentDiagnostic, MissionFlightPlan, MissionJourney, MissionOperations, MissionResults } from "@workspace/api-zod";
import { componentById } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";

export type JourneyPhase = MissionJourney["phase"];
export const COLLECTION_MS=8000, RETURN_MS=20000, REENTRY_MS=12000, RECOVERY_MS=6000;
export const sites = {regolith:2,crater:3,ridge:5} as const;
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*1000)/1000;
const quality=(o:MissionOperations,id:string)=>Math.max(
  o.components.find(c=>c.categoryId===id)?.quality??0,
  ...o.equipment.filter(e=>e.available&&scientificInstruments.some(i=>i.id===e.id&&i.group===id))
    .map(e=>scientificInstruments.find(i=>i.id===e.id)!.quality),
);
const name=(o:MissionOperations,id:string)=>o.components.find(c=>c.categoryId===id)?.name??"Not installed";
/** Heavy launch stages and the descent lander stay behind. Only the selected
 * return module, its avionics and remaining reserve participate in this burn. */
export function returnFuelRequirement(selections:Record<string,string>,remainingFuel:number,isp:number,sampleMass=0) {
  const carried=["upper-stage-engines","orbital-maneuvering","onboard-computer","navigation-sensors","attitude-control",
    "electrical-power-system","batteries","communication","thermal-protection","sample-container","return-capsule",
    "re-entry-heat-shield","recovery-system","lunar-ascent-system"];
  const dryMass=500+carried.reduce((s,id)=>s+(componentById.get(selections[id])?.massKg??100),0)+sampleMass;
  const ascentQuality=componentById.get(selections["lunar-ascent-system"])?.quality??0;
  const deltaV=1600*(1.1-ascentQuality*0.002);
  return round((dryMass+Math.max(0,remainingFuel))*(1-Math.exp(-deltaV/(9.80665*Math.max(1,isp)))));
}
const maxAcceleration=(o:MissionOperations)=>3.5+quality(o,"lunar-descent-engine")/100*1.5;
export function recommendedThrust(o:MissionOperations) {
  const target=o.landing.altitudeM<50?1.5:4;
  return round(clamp((1.62+(o.landing.velocityMps-target)*0.85)/maxAcceleration(o))*100);
}

/** Explicit training model: shared propellant reserve, not certified lander/orbit physics. */
export function makeOperations(selections:Record<string,string>,diagnostics:InstrumentDiagnostic[],remainingFuelKg:number):MissionOperations {
  const components=Object.entries(selections).map(([categoryId,id])=>{
    const c=componentById.get(id);
    return {categoryId,name:c?.name??id,quality:c?.quality??0};
  });
  const missing:Record<string,string>={
    "lunar-spectrometer":"SPECTROMETER MISSING — Mineral composition analysis unavailable.",
    "lunar-magnetometer":"MAGNETOMETER MISSING — Magnetic field measurements unavailable.",
    "radiation-detector":"RADIATION DETECTOR MISSING — Radiation measurements unavailable.",
    "subsurface-radar":"SUBSURFACE RADAR MISSING — Underground scanning unavailable.",
    "advanced-sample-analyzer":"SAMPLE ANALYZER MISSING — On-site sample analysis unavailable.",
  };
  const equipment=scientificInstruments.map(i=>{
    const d=diagnostics.find(d=>d.instrumentId===i.id);
    const available=!!d&&["OPERATIONAL","DAMAGED"].includes(d.status);
    return {id:i.id,name:i.name,status:d?.status??"MISSING" as const,available,potential:available?d!.availableSciencePoints:0,
      warning:available?null:d?`${i.name.toUpperCase()} UNAVAILABLE — ${d.failure??"Instrument did not pass diagnostics."}`:missing[i.id]??null};
  });
  const hasCamera=equipment.some(e=>e.id.endsWith("camera")&&e.available);
  // Earth-only GNSS is not an alternative for lunar optical navigation.
  const nav=components.find(c=>c.categoryId==="navigation-sensors");
  const alternativeNavigation=!!nav&&nav.quality>=40&&/inertial|stim210|star.tracker|sagitta|hydra/i.test(nav.name);
  const warnings=equipment.flatMap(e=>e.warning?[e.warning]:[]);
  if(!hasCamera) warnings.unshift(equipment.some(e=>e.id.endsWith("camera")&&e.status!=="MISSING")
    ?"CAMERA UNAVAILABLE — No installed camera survived. Visual feed unavailable."
    :"NO VIDEO SIGNAL — Lunar surface visualization unavailable.");
  if(!hasCamera&&!alternativeNavigation) warnings.unshift("MISSION AT RISK — REQUIRED SCIENTIFIC EQUIPMENT MISSING. No working camera or lunar-capable inertial/star-tracker navigation: safe visual navigation is impossible. Landing is blocked; you may return without samples.");
  const hasEquipment=(group:string)=>components.some(c=>c.categoryId===group)
    ||equipment.some(e=>e.available&&scientificInstruments.some(i=>i.id===e.id&&i.group===group));
  const collector=hasEquipment("sample-collection"),container=hasEquipment("sample-container");
  const canCollect=collector&&container;
  if(!collector)warnings.push("SAMPLE COLLECTION UNAVAILABLE — Cannot collect lunar samples.");
  if(!container)warnings.push("SAMPLE STORAGE MISSING — Cannot safely return lunar samples to Earth.");
  const o:MissionOperations={
    components,equipment,warnings,hasCamera,alternativeNavigation,canCollect,
    landing:{status:"READY",altitudeM:120,velocityMps:4,thrust:0,recommendedThrust:0,fuelUsedKg:0,startedAt:null,lastTickAt:null,elapsedSeconds:0},
    collectionProgress:0,siteId:null,siteStartedAt:null,collectedSites:[],sampleMassKg:0,scienceEarned:0,remainingFuelKg,
    returnInitialFuelKg:0,returnStartedAt:null,returnRequiredKg:0,returnProgress:0,returnManeuver:"LUNAR_ORBIT",
    reentryStartedAt:null,recoveryStartedAt:null,missionDay:1,failure:null,results:null,
  };
  o.landing.recommendedThrust=recommendedThrust(o);
  o.landing.thrust=o.landing.recommendedThrust;
  return o;
}

export function advanceOperations(phase:JourneyPhase,saved:MissionOperations,plan:MissionFlightPlan,now:number) {
  const o=structuredClone(saved);
  if(phase==="RESULTS")return {phase,operations:o};
  let next=phase;
  if(phase==="LANDING"&&o.landing.status==="DESCENDING") {
    const l=o.landing;
    let dt=clamp((now-Date.parse(l.lastTickAt!))/1000,0,100);
    while(dt>0&&l.status==="DESCENDING") {
      const step=Math.min(0.1,dt);
      // Always-on stability assist makes the controls forgiving, including old
      // active saves and delayed commands. It adjusts thrust, never adds fuel.
      if(o.remainingFuelKg>0) {
        const guidance=recommendedThrust(o);
        l.thrust=clamp(l.thrust,Math.max(0,guidance-8),Math.min(100,guidance+8));
      }
      const throttle=o.remainingFuelKg>0?l.thrust/100:0;
      const used=Math.min(o.remainingFuelKg,5*throttle*step);
      const actualThrottle=used/(5*step);
      o.remainingFuelKg-=used;l.fuelUsedKg+=used;
      l.velocityMps=clamp(l.velocityMps+(1.62-maxAcceleration(o)*actualThrottle)*step,-12,60);
      l.altitudeM-=l.velocityMps*step;l.elapsedSeconds+=step;dt-=step;
      if(l.altitudeM<=0) {
        l.altitudeM=0;
        const safe=l.velocityMps<=6&&quality(o,"landing-legs")>=40;
        l.status=safe?"LANDED":"CRASHED";next=safe?"SAMPLE_COLLECTION":"LANDING_FAILED";
        o.returnManeuver=safe?"LUNAR_SURFACE":"LANDER_LOST";
        if(!safe)o.failure=`Hard landing at ${round(l.velocityMps)} m/s. ${name(o,"landing-legs")} could not protect the lander and samples were not collected.`;
        l.velocityMps=0;
      } else if(l.elapsedSeconds>=150||l.altitudeM>300) {
        l.status="CRASHED";next="LANDING_FAILED";
        o.failure="Lunar descent window exceeded. The lander was lost after failing to reach a controlled touchdown.";
      }
    }
    l.lastTickAt=new Date(now).toISOString();l.recommendedThrust=recommendedThrust(o);
    l.altitudeM=round(l.altitudeM);l.velocityMps=round(l.velocityMps);l.fuelUsedKg=round(l.fuelUsedKg);l.elapsedSeconds=round(l.elapsedSeconds);
  }
  if(phase==="SAMPLE_COLLECTION"&&o.siteId&&o.siteStartedAt) {
    o.collectionProgress=clamp((now-Date.parse(o.siteStartedAt))/COLLECTION_MS);
    if(o.collectionProgress>=1&&!o.collectedSites.includes(o.siteId)) {
      o.collectedSites.push(o.siteId);
      // Recompute totals from unique sites, never increment awards on retries.
      const factor=clamp(quality(o,"sample-collection")/100,0.25,1);
      o.sampleMassKg=round(o.collectedSites.reduce((sum,id)=>sum+(sites[id as keyof typeof sites]??0)*factor,0));
      o.scienceEarned=Math.floor(o.equipment.reduce((s,i)=>s+i.potential,0)*o.collectedSites.length/3);
      o.siteId=null;o.siteStartedAt=null;
    }
  }
  if(phase==="RETURN_FLIGHT"&&o.returnStartedAt) {
    let p=clamp((now-Date.parse(o.returnStartedAt))/RETURN_MS);
    const launch=o.returnRequiredKg*0.55,arrival=o.returnRequiredKg-launch;
    const needed=launch*clamp(p/0.2)+arrival*clamp((p-0.85)/0.15);
    if(needed>o.returnInitialFuelKg+0.00001) {
      p=o.returnInitialFuelKg<launch?0.2*o.returnInitialFuelKg/Math.max(1,launch)
        :0.85+0.15*(o.returnInitialFuelKg-launch)/Math.max(1,arrival);
      o.remainingFuelKg=0;next="RETURN_FAILED";o.returnManeuver="ENGINE_OUT";
      o.failure="FUEL EXHAUSTED — EARTH NOT REACHED. Engines shut down before completing the return maneuvers. The spacecraft drifted off the Earth-return trajectory; the capsule and lunar samples were not recovered.";
    } else {
      o.remainingFuelKg=Math.max(0,o.returnInitialFuelKg-needed);
      o.returnManeuver=p<0.2?"ASCENT":p<0.85?"RETURN_COAST":"EARTH_INSERTION";
      if(p>=1){next="REENTRY";o.returnManeuver="ATMOSPHERIC_ENTRY";o.reentryStartedAt=new Date(Date.parse(o.returnStartedAt)+RETURN_MS).toISOString();}
    }
    o.returnProgress=next==="RETURN_FAILED"?Math.min(0.999,round(p)):round(p);
  }
  if(phase==="REENTRY"&&o.reentryStartedAt&&now-Date.parse(o.reentryStartedAt)>=REENTRY_MS) {
    const capacity=quality(o,"re-entry-heat-shield")*0.65+quality(o,"thermal-protection")*0.2+quality(o,"return-capsule")*0.15;
    const demand=45+Math.min(20,o.sampleMassKg*0.8+plan.dryMassKg/10000*2);
    if(capacity<demand) {
      next="RETURN_FAILED";o.returnManeuver="HEAT_SHIELD_FAILURE";
      o.failure=`RE-ENTRY FAILURE — ${name(o,"re-entry-heat-shield")} and the selected thermal protection could not withstand the modeled entry load (${round(capacity)} protection / ${round(demand)} required). Capsule and samples lost.`;
    }else{
      next="RECOVERY";o.returnManeuver="PARACHUTE_DESCENT";o.recoveryStartedAt=new Date(Date.parse(o.reentryStartedAt)+REENTRY_MS).toISOString();
    }
  }
  if(phase==="RECOVERY"&&o.recoveryStartedAt&&now-Date.parse(o.recoveryStartedAt)>=RECOVERY_MS) {
    if(quality(o,"recovery-system")<40||quality(o,"return-capsule")<40) {
      next="RETURN_FAILED";o.returnManeuver="RECOVERY_FAILURE";
      o.failure=`RECOVERY FAILURE — ${name(o,"recovery-system")} could not safely recover ${name(o,"return-capsule")}. Samples were lost on impact.`;
    }else o.returnManeuver="LANDED_ON_EARTH";
  }
  o.remainingFuelKg=round(o.remainingFuelKg);
  o.missionDay=Math.max(1,Math.ceil(plan.outboundDays+(o.landing.status==="LANDED"?1:0)+o.collectedSites.length*2+plan.returnDays*o.returnProgress));
  return {phase:next,operations:o};
}

export function missionResults(o:MissionOperations,plan:MissionFlightPlan,budget:number,outboundReached=true):MissionResults {
  const recovered=o.returnManeuver==="LANDED_ON_EARTH"&&!o.failure;
  const scienceMax=scientificInstruments.reduce((s,i)=>s+i.maxSciencePoints,0);
  const objectives=[
    {id:"moon",label:"Reach the Moon",weight:10,completion:outboundReached?1:0,detail:outboundReached?"Outbound transfer completed.":"Spacecraft never reached the Moon."},
    {id:"landing",label:"Land safely on the Moon",weight:20,completion:o.landing.status==="LANDED"?1:0,detail:`Lander: ${o.landing.status.toLowerCase()}.`},
    {id:"samples",label:"Collect samples from three locations",weight:20,completion:o.collectedSites.length/3,detail:`${o.collectedSites.length}/3 locations; ${o.sampleMassKg} kg collected.`},
    {id:"science",label:"Complete the full science program",weight:10,completion:o.scienceEarned/scienceMax,detail:`${o.scienceEarned}/${scienceMax} Science Points earned; missing or failed instruments reduced this objective.`},
    {id:"return",label:"Reach Earth on the return trajectory",weight:20,completion:o.returnProgress>=1?1:0,detail:o.returnProgress>=1?"Earth arrival confirmed.":"Earth was not reached."},
    {id:"entry",label:"Survive atmospheric re-entry",weight:10,completion:o.recoveryStartedAt?1:0,detail:o.recoveryStartedAt?"Heat shield protected the capsule.":"Atmospheric entry was not completed."},
    {id:"recovery",label:"Recover the capsule and lunar samples",weight:10,completion:recovered&&o.sampleMassKg>=1?1:0,detail:recovered?`${o.sampleMassKg} kg recovered on Earth.`:"Capsule and samples were not recovered."},
  ];
  return {success:recovered&&o.sampleMassKg>=1,completionPercent:Math.round(objectives.reduce((s,i)=>s+i.weight*clamp(i.completion),0)),
    sampleMassKg:o.sampleMassKg,recoveredSampleMassKg:recovered?o.sampleMassKg:0,scienceEarned:o.scienceEarned,
    recoveredSciencePoints:recovered?o.scienceEarned:0,durationDays:o.missionDay,
    remainingBudget:budget,failure:o.failure??(o.sampleMassKg<1?"Main objective incomplete: at least 1 kg of lunar samples must be safely returned to Earth.":null),objectives};
}
