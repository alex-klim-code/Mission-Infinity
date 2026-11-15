import { test } from "node:test";
import assert from "node:assert/strict";
import { componentCategories } from "./rocket-catalog";
import { scientificInstruments } from "./scientific-instruments";
import { makeFlightPlan } from "./mission-flight-model";
import { advanceOperations, LANDING_TIME_SCALE, makeOperations, missionResults, recommendedThrust } from "./lunar-operations-model";

const selections=Object.fromEntries(componentCategories.map(c=>[c.id,c.options.reduce((a,b)=>(a.quality??0)>(b.quality??0)?a:b).id]));
const diagnostics=scientificInstruments.filter(i=>i.powerW!==null).map(i=>({instrumentId:i.id,name:i.name,quality:i.quality,status:"OPERATIONAL" as const,
  maxSciencePoints:i.maxSciencePoints,availableSciencePoints:i.maxSciencePoints,failure:null,progress:1}));
const plan=makeFlightPlan("falcon-shadow",selections,[],30000);
const time=Date.UTC(2026,10,14);

test("instrument validation distinguishes missing, broken and damaged; no analyzer still allows physical collection",()=>{
  const empty=makeOperations(selections,[],10000);
  assert.equal(empty.hasCamera,false);assert.equal(empty.canCollect,true);
  assert.equal(empty.equipment.find(i=>i.id==="advanced-sample-analyzer")?.available,false);
  assert.ok(empty.warnings.some(w=>w.startsWith("NO VIDEO SIGNAL")));
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

test("landing assist permits ordinary fixed throttle without continuous precision input",()=>{
  for(const thrust of [0,30,50,100]){
    let o=makeOperations(selections,diagnostics,10000);
    let phase:"LANDING"|"SAMPLE_COLLECTION"|"LANDING_FAILED"="LANDING";
    o.landing={...o.landing,status:"DESCENDING",thrust,startedAt:new Date(time).toISOString(),lastTickAt:new Date(time).toISOString()};
    for(let t=1000;t<=150000&&phase==="LANDING";t+=1000){
      // Even repeatedly moving the slider to an extreme stays controllable.
      o.landing.thrust=thrust;
      const result=advanceOperations(phase,o,plan,time+t);
      o=result.operations;phase=result.phase as typeof phase;
    }
    assert.equal(phase,"SAMPLE_COLLECTION",`Throttle ${thrust}% should be forgiving`);
    assert.equal(o.landing.status,"LANDED");
    assert.ok(o.landing.fuelUsedKg>0);
    assert.ok(Math.abs(o.remainingFuelKg+o.landing.fuelUsedKg-10000)<.1);
  }
});

test("landing assist also guides saved descents across long gaps and slower engines",()=>{
  const o=makeOperations(selections,diagnostics,10000);
  o.components=o.components.map(c=>c.categoryId==="lunar-descent-engine"?{...c,quality:55}:c);
  o.landing={...o.landing,status:"DESCENDING",velocityMps:8,thrust:0,startedAt:new Date(time).toISOString(),lastTickAt:new Date(time).toISOString()};
  const result=advanceOperations("LANDING",o,plan,time+100000);
  assert.equal(result.phase,"SAMPLE_COLLECTION");
  assert.equal(result.operations.landing.status,"LANDED");
  assert.ok(result.operations.remainingFuelKg<10000);
});

test("powered descent runs three simulation seconds per wall second without duplicating fuel use",()=>{
  const o=makeOperations(selections,diagnostics,10000);
  o.landing={...o.landing,status:"DESCENDING",startedAt:new Date(time).toISOString(),lastTickAt:new Date(time).toISOString()};
  const next=advanceOperations("LANDING",o,plan,time+1000);
  assert.equal(LANDING_TIME_SCALE,3);
  assert.equal(next.operations.landing.elapsedSeconds,3);
  assert.ok(next.operations.landing.altitudeM<o.landing.altitudeM);
  assert.ok(next.operations.landing.fuelUsedKg>0);
  assert.ok(Math.abs(next.operations.remainingFuelKg+next.operations.landing.fuelUsedKg-10000)<.01);
  const retried=advanceOperations(next.phase,next.operations,plan,time+1000).operations;
  assert.deepEqual([retried.remainingFuelKg,retried.landing.fuelUsedKg,retried.landing.altitudeM,retried.landing.elapsedSeconds],
    [next.operations.remainingFuelKg,next.operations.landing.fuelUsedKg,next.operations.landing.altitudeM,next.operations.landing.elapsedSeconds],
    "Same-timestamp retry cannot advance or burn fuel twice.");
  assert.deepEqual(o.landing.elapsedSeconds,0,"The input save remains unchanged.");
});

test("accelerated assisted descents finish within thirty wall seconds with either throttle extreme",()=>{
  for(const q of [55,95])for(const thrust of [0,100]){
    let o=makeOperations(selections,diagnostics,10000);
    o.components=o.components.map(c=>c.categoryId==="lunar-descent-engine"?{...c,quality:q}:c);
    o.landing={...o.landing,status:"DESCENDING",thrust,startedAt:new Date(time).toISOString(),lastTickAt:new Date(time).toISOString()};
    let phase:"LANDING"|"SAMPLE_COLLECTION"|"LANDING_FAILED"="LANDING";
    for(let elapsed=500;elapsed<=30000&&phase==="LANDING";elapsed+=500){
      o.landing.thrust=thrust;
      const next=advanceOperations(phase,o,plan,time+elapsed);
      phase=next.phase as typeof phase;o=next.operations;
    }
    assert.equal(phase,"SAMPLE_COLLECTION",`Q${q} at ${thrust}% throttle must land within thirty seconds`);
    assert.ok(o.remainingFuelKg>0);
  }
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
  const fullProgram=scientificInstruments.map(i=>({instrumentId:i.id,name:i.name,quality:i.quality,status:"OPERATIONAL" as const,
    maxSciencePoints:i.maxSciencePoints,availableSciencePoints:i.maxSciencePoints,failure:null,progress:1}));
  const o=makeOperations(selections,fullProgram,3000);
  Object.assign(o,{sampleMassKg:10,scienceEarned:fullProgram.reduce((sum,i)=>sum+i.maxSciencePoints,0),collectedSites:["regolith","crater","ridge"],returnProgress:1,returnManeuver:"LANDED_ON_EARTH",recoveryStartedAt:new Date(time).toISOString(),missionDay:14});
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
