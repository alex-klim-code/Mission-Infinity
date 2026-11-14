import {test} from "node:test";
import assert from "node:assert/strict";
import { assessPayload, engineSpecifications, G0, type PayloadInput } from "./index";

/** Synthetic numbers are confined to these numerical test fixtures. */
function single():PayloadInput {
  return {components:[
    {id:"hull",name:"Test hull",categoryId:"rocket-body",massKg:100},
    {id:"main",name:"Test engine",categoryId:"main-engines",massKg:10,thrustN:100000,specificImpulseSeconds:350},
  ],instruments:[{id:"camera",massKg:20}],fuelKg:1000,profile:{source:"Synthetic unit test",stages:[
    {id:"one",componentCategoryIds:["rocket-body","main-engines"],engineCategoryIds:["main-engines"],fuelFraction:1},
  ],burns:[
    {id:"launch",stageId:"one",phase:"LAUNCH",requiredDeltaVMps:1000,separateStageIds:[]},
    {id:"landing",stageId:"one",phase:"LUNAR_LANDING",requiredDeltaVMps:500,separateStageIds:[]},
    {id:"return",stageId:"one",phase:"EARTH_RETURN",requiredDeltaVMps:500,separateStageIds:[]},
  ]}};
}
function multi():PayloadInput {
  const i=single();
  i.components.push({id:"upper",name:"Test upper engine",categoryId:"upper-stage-engines",massKg:8,thrustN:20000,specificImpulseSeconds:450});
  i.components[1].thrustN=1e6;
  i.fuelKg=10000;
  i.profile!.stages[0].fuelFraction=.6;
  i.profile!.stages.push({id:"upper",componentCategoryIds:["upper-stage-engines"],engineCategoryIds:["upper-stage-engines"],fuelFraction:.4});
  i.profile!.burns=[
    {id:"launch",stageId:"one",phase:"LAUNCH",requiredDeltaVMps:2000,separateStageIds:["one"]},
    {id:"transfer",stageId:"upper",phase:"OUTBOUND",requiredDeltaVMps:1000,separateStageIds:[]},
    {id:"landing",stageId:"upper",phase:"LUNAR_LANDING",requiredDeltaVMps:500,separateStageIds:[]},
    {id:"return",stageId:"upper",phase:"EARTH_RETURN",requiredDeltaVMps:1500,separateStageIds:[]},
  ];
  return i;
}
test("matches analytic single-stage rocket equation and capacity",()=>{
  const i=single(),a=assessPayload(i);
  assert.equal(a.status,"COMPLETE");assert.equal(a.feasible,true);
  assert.equal(a.totalMassKg,1130);assert.equal(a.currentPayloadKg,20);
  assert.ok(Math.abs(a.availableDeltaVMps!-350*G0*Math.log(1130/130))<1e-8);
  const expected=1000/Math.expm1(2000/(350*G0))-110;
  assert.ok(Math.abs(a.maximumPayloadKg!-expected)<1e-5);
  assert.equal(a.remainingPayloadKg,a.maximumPayloadKg!-20);
  assert.ok(Math.abs(a.launchTwr!-100000/(1130*G0))<1e-12);
});
test("all hardware, engine, fuel and scientific masses counted exactly once",()=>{
  const i=single();i.components.push({id:"sampler",name:"Sampler",categoryId:"sample-collection",massKg:5});
  i.components.push({...i.components[0]});
  const a=assessPayload(i);assert.equal(a.totalMassKg,1135);assert.equal(a.currentPayloadKg,25);
  assert.ok(a.maximumPayloadKg!>1000);
});
test("multistage separation discards dry hardware AND unspent propellant",()=>{
  const i=multi();i.profile!.burns[0].requiredDeltaVMps=500;
  const a=assessPayload(i);
  assert.equal(a.feasible,true);assert.equal(a.burns.length,4);
  const retained=structuredClone(i);retained.profile!.burns[0].separateStageIds=[];
  const b=assessPayload(retained);
  assert.ok(a.maximumPayloadKg!>b.maximumPayloadKg!);
  assert.ok(a.burns[1].initialMassKg<b.burns[1].initialMassKg);
  assert.equal(a.totalThrustN,1020000);assert.equal(a.launchThrustN,1000000);
});
test("numerical capacity is feasible, adding mass beyond it is not",()=>{
  const i=multi(),a=assessPayload(i);
  i.instruments=[{id:"test",massKg:a.maximumPayloadKg!-.001}];
  assert.equal(assessPayload(i).feasible,true);
  i.instruments[0].massKg=a.maximumPayloadKg!+1;
  const over=assessPayload(i);
  assert.equal(over.feasible,false);assert.ok(over.warnings.includes("OVERWEIGHT"));
  assert.ok(over.remainingPayloadKg!<0);
});
test("capacity updates with actual fuel, engine Isp and hardware mass",()=>{
  const base=single(),a=assessPayload(base);
  const fuel=structuredClone(base);fuel.fuelKg=1200;
  assert.ok(assessPayload(fuel).maximumPayloadKg!>a.maximumPayloadKg!);
  const isp=structuredClone(base);isp.components[1].specificImpulseSeconds=400;
  assert.ok(assessPayload(isp).maximumPayloadKg!>a.maximumPayloadKg!);
  const mass=structuredClone(base);mass.components[0].massKg=200;
  assert.ok(assessPayload(mass).maximumPayloadKg!<a.maximumPayloadKg!);
});
test("launch requires TWR strictly greater than one; low thrust is not hidden by upper engines",()=>{
  const i=multi();i.components[1].thrustN=1000;
  const a=assessPayload(i);assert.equal(a.maximumPayloadKg,0);
  assert.ok(a.warnings.includes("INSUFFICIENT THRUST"));assert.equal(a.feasible,false);
  const exact=single();exact.components[1].thrustN=1130*G0;
  assert.ok(assessPayload(exact).warnings.includes("INSUFFICIENT THRUST"));
});
test("landing and Earth-return requirements reduce allowable payload; reserves cannot be spent twice",()=>{
  const i=multi(),a=assessPayload(i);
  i.profile!.burns[3].requiredDeltaVMps=30000;
  const b=assessPayload(i);
  assert.ok(b.warnings.includes("INSUFFICIENT RETURN FUEL"));
  assert.ok(b.warnings.includes("INSUFFICIENT DELTA-V"));
  assert.ok(b.maximumPayloadKg!<a.maximumPayloadKg!);
  assert.ok(b.requiredReturnFuelKg!>b.availableReturnFuelKg!);
});
test("no fabricated masses, performance, fuel splits or mission requirements",()=>{
  for(const mutate of [
    (i:PayloadInput)=>{i.components[0].massKg=null;},
    (i:PayloadInput)=>{i.components[1].thrustN=null;},
    (i:PayloadInput)=>{i.components[1].specificImpulseSeconds=null;},
    (i:PayloadInput)=>{i.fuelKg=null;},
    (i:PayloadInput)=>{i.profile=null;},
    (i:PayloadInput)=>{i.profile!.stages[0].fuelFraction=.5;},
    (i:PayloadInput)=>{i.profile!.burns[2].requiredDeltaVMps=NaN;},
  ]){
    const i=single();mutate(i);const a=assessPayload(i);
    assert.equal(a.status,"INCOMPLETE");assert.equal(a.maximumPayloadKg,null);
    assert.equal(a.availableDeltaVMps,null);assert.ok(a.missingData.length>0);
  }
});
test("a separated stage cannot burn again; ambiguous component assignment is incomplete",()=>{
  const i=multi();i.profile!.burns[1].stageId="one";
  assert.equal(assessPayload(i).status,"INCOMPLETE");
  const j=multi();j.profile!.stages[1].componentCategoryIds.push("rocket-body");
  assert.equal(assessPayload(j).status,"INCOMPLETE");
});
test("parser accepts labelled units only, including fractional newtons",()=>{
  assert.deepEqual(engineSpecifications("Thrust: 981000 N; Isp: 348 s"),{thrustN:981000,specificImpulseSeconds:348});
  assert.deepEqual(engineSpecifications("Thrust: 0.09 N; Isp: 1660 s"),{thrustN:.09,specificImpulseSeconds:1660});
  assert.deepEqual(engineSpecifications("2 kN thrust"),{thrustN:2000,specificImpulseSeconds:null});
  assert.deepEqual(engineSpecifications("Custom game specification Q95"),{thrustN:null,specificImpulseSeconds:null});
});
