import { test } from "node:test";
import assert from "node:assert/strict";
import { componentCategories } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";
import { makeFlightPlan } from "./mission-flight-model";
import { advanceOperations, makeOperations, missionResults, recommendedThrust } from "./lunar-operations-model";

const selections=Object.fromEntries(componentCategories.map(c=>[c.id,c.options.reduce((a,b)=>(a.quality??0)>(b.quality??0)?a:b).id]));
const diagnostics=scientificInstruments.map(i=>({instrumentId:i.id,name:i.name,quality:i.quality,status:"OPERATIONAL" as const,
  maxSciencePoints:i.maxSciencePoints,availableSciencePoints:i.maxSciencePoints,failure:null,progress:1}));
const plan=makeFlightPlan("falcon-shadow",selections,[],30000);
const time=Date.UTC(2026,10,14);

test("instrument validation distinguishes missing, broken and damaged; no analyzer still allows physical collection",()=>{
  const empty=makeOperations(selections,[],10000);
  assert.equal(empty.hasCamera,false);assert.equal(empty.canCollect,true);
  assert.equal(empty.equipment.find(i=>i.id==="advanced-sample-analyzer")?.available,false);
  assert.ok(empty.warnings.some(w=>w.startsWith("NO CAMERA INSTALLED")));
  assert.ok(empty.warnings.some(w=>w.startsWith("SPECTROMETER MISSING")));
  const broken=makeOperations(selections,[{...diagnostics[0],status:"CRITICAL_FAILURE",availableSciencePoints:0}],10000);
  assert.equal(broken.hasCamera,false);
  assert.ok(broken.warnings.some(w=>w.startsWith("CAMERA UNAVAILABLE")));
  const damaged=makeOperations(selections,[{...diagnostics[0],status:"DAMAGED",availableSciencePoints:50}],10000);
  assert.equal(damaged.hasCamera,true);assert.equal(damaged.equipment[0].potential,50);
  const gnss={...selections,"navigation-sensors":componentCategories.find(c=>c.id==="navigation-sensors")!.options.find(i=>/GNSS/i.test(i.name))!.id};
  const noNav=makeOperations(gnss,[],10000);
  assert.equal(noNav.alternativeNavigation,false);
  assert.ok(noNav.warnings.some(w=>w.includes("MISSION AT RISK")));
});

test("manual thrust physics permits a controlled landing and rejects a ballistic hard landing",()=>{
  let o=makeOperations(selections,diagnostics,10000),phase:"LANDING"|"SAMPLE_COLLECTION"|"LANDING_FAILED"="LANDING";
  o.landing.status="DESCENDING";o.landing.startedAt=new Date(time).toISOString();o.landing.lastTickAt=o.landing.startedAt;
  for(let t=250;t<=90000&&phase==="LANDING";t+=250) {
    o.landing.thrust=recommendedThrust(o);
    const result=advanceOperations(phase,o,plan,time+t);o=result.operations;phase=result.phase as typeof phase;
  }
  assert.equal(phase,"SAMPLE_COLLECTION");assert.equal(o.landing.altitudeM,0);
  assert.ok(o.landing.fuelUsedKg>0);assert.ok(o.remainingFuelKg<10000);
  assert.ok(o.landing.elapsedSeconds<90);
  const ballistic=makeOperations(selections,diagnostics,0);
  ballistic.landing={...ballistic.landing,status:"DESCENDING",thrust:0,startedAt:new Date(time).toISOString(),lastTickAt:new Date(time).toISOString()};
  const crash=advanceOperations("LANDING",ballistic,plan,time+30000);
  assert.equal(crash.phase,"LANDING_FAILED");assert.ok(crash.operations.failure?.includes("Hard landing"));
});

test("collections are resumable, unique and cannot farm samples or Science Points",()=>{
  let o=makeOperations(selections,diagnostics,10000);
  o.landing.status="LANDED";o.siteId="regolith";o.siteStartedAt=new Date(time).toISOString();
  const partial=advanceOperations("SAMPLE_COLLECTION",o,plan,time+4000).operations;
  assert.equal(partial.collectionProgress,0.5);assert.equal(partial.sampleMassKg,0);
  o=advanceOperations("SAMPLE_COLLECTION",partial,plan,time+9000).operations;
  assert.equal(o.collectedSites.length,1);assert.equal(o.scienceEarned,Math.floor(1540/3));
  const repeated=advanceOperations("SAMPLE_COLLECTION",o,plan,time+100000).operations;
  assert.equal(repeated.sampleMassKg,o.sampleMassKg);assert.equal(repeated.scienceEarned,o.scienceEarned);
});

test("return coast never burns fuel and an empty reserve freezes short of Earth on repeat/reload",()=>{
  const o=makeOperations(selections,diagnostics,9000);
  o.returnStartedAt=new Date(time).toISOString();o.returnInitialFuelKg=9000;o.returnRequiredKg=10000;
  const first=advanceOperations("RETURN_FLIGHT",o,plan,time+8000);
  const second=advanceOperations("RETURN_FLIGHT",o,plan,time+14000);
  assert.equal(first.operations.returnManeuver,"RETURN_COAST");
  assert.equal(first.operations.remainingFuelKg,3500);
  assert.equal(second.operations.remainingFuelKg,3500);
  const failed=advanceOperations("RETURN_FLIGHT",o,plan,time+21000);
  assert.equal(failed.phase,"RETURN_FAILED");assert.ok(failed.operations.returnProgress<1);
  assert.equal(failed.operations.remainingFuelKg,0);assert.match(failed.operations.failure!,/EARTH NOT REACHED/);
  assert.deepEqual(advanceOperations(failed.phase,failed.operations,plan,time+999999).operations,failed.operations);
});

test("selected thermal protection and recovery system determine capsule survival",()=>{
  const o=makeOperations(selections,diagnostics,3000);
  o.returnProgress=1;o.reentryStartedAt=new Date(time).toISOString();o.returnManeuver="ATMOSPHERIC_ENTRY";
  const safe=advanceOperations("REENTRY",o,plan,time+13000);
  assert.equal(safe.phase,"RECOVERY");
  const landed=advanceOperations("RECOVERY",safe.operations,plan,time+19000);
  assert.equal(landed.operations.returnManeuver,"LANDED_ON_EARTH");
  const poor=structuredClone(o);
  poor.components=poor.components.map(c=>["thermal-protection","re-entry-heat-shield","return-capsule"].includes(c.categoryId)?{...c,quality:5}:c);
  assert.match(advanceOperations("REENTRY",poor,plan,time+13000).operations.failure!,/RE-ENTRY FAILURE/);
  const badRecovery=structuredClone(safe.operations);
  badRecovery.components=badRecovery.components.map(c=>c.categoryId==="recovery-system"?{...c,quality:5}:c);
  assert.match(advanceOperations("RECOVERY",badRecovery,plan,time+19000).operations.failure!,/RECOVERY FAILURE/);
});

test("Stage 8 uses explicit weights totaling 100 and distinguishes collected from recovered samples",()=>{
  const o=makeOperations(selections,diagnostics,3000);
  Object.assign(o,{sampleMassKg:10,scienceEarned:1540,collectedSites:["regolith","crater","ridge"],returnProgress:1,returnManeuver:"LANDED_ON_EARTH",recoveryStartedAt:new Date(time).toISOString(),missionDay:14});
  o.landing.status="LANDED";
  const all=missionResults(o,plan,123456789);
  assert.equal(all.objectives.reduce((s,i)=>s+i.weight,0),100);assert.equal(all.completionPercent,100);
  assert.equal(all.success,true);assert.equal(all.remainingBudget,123456789);
  o.failure="Fuel exhausted";o.returnProgress=0.6;o.returnManeuver="ENGINE_OUT";o.recoveryStartedAt=null;
  const lost=missionResults(o,plan,123456789);
  assert.equal(lost.success,false);assert.equal(lost.recoveredSampleMassKg,0);
  assert.equal(lost.sampleMassKg,10);assert.equal(lost.recoveredSciencePoints,0);
  assert.equal(lost.completionPercent,60);
});
