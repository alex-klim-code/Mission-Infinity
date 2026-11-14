import {test} from "node:test";
import assert from "node:assert/strict";
import {assessGameplayPayload,type PayloadInput} from "./index";

function configuration(q=65):PayloadInput{
  return {components:[
    {id:"falcon-shadow",name:"Falcon Shadow",categoryId:"rocket-body",massKg:null,quality:null},
    {id:"main",name:"Main engine",categoryId:"main-engines",massKg:1000,quality:q},
    {id:"upper",name:"Upper engine",categoryId:"upper-stage-engines",massKg:500,quality:q},
    {id:"stages",name:"LUNA Triple",categoryId:"rocket-stages",massKg:1000,quality:q},
  ],instruments:[{id:"camera",massKg:3}],fuelKg:null};
}
test("partial catalog configurations receive finite Quality reference values",()=>{
  for(const i of [configuration(),{components:[],instruments:[],fuelKg:null}]){
    const a=assessGameplayPayload(i);
    assert.equal(a.status,"COMPLETE");assert.equal(a.basis,"QUALITY");
    assert.ok(Number.isFinite(a.maximumPayloadKg));assert.ok(a.maximumPayloadKg!>0);
    assert.ok(Number.isFinite(a.launchTwr));assert.ok(Number.isFinite(a.availableDeltaVMps));
    assert.deepEqual(a.missingData,[]);
  }
});
test("higher engine and structure quality improves capacity at unchanged mass",()=>{
  const low=assessGameplayPayload(configuration(30)),high=assessGameplayPayload(configuration(95));
  assert.ok(high.maximumPayloadKg!>low.maximumPayloadKg!);
  assert.ok(high.launchTwr!>low.launchTwr!);
});
test("new instruments reduce remaining allowance without upgrading propulsion",()=>{
  const i=configuration(),a=assessGameplayPayload(i);
  i.instruments.push({id:"radar",massKg:15});
  const b=assessGameplayPayload(i);
  assert.equal(b.maximumPayloadKg,a.maximumPayloadKg);
  assert.equal(b.currentPayloadKg,a.currentPayloadKg!+15);
  assert.equal(b.remainingPayloadKg,a.remainingPayloadKg!-15);
});
test("planned full fuel switches to actual fuel and never invents a refill at zero",()=>{
  const i=configuration(),planned=assessGameplayPayload(i);
  assert.equal(planned.referenceFuelKg,30000);assert.equal(planned.fuelIsEstimate,true);
  i.fuelKg=5000;const partial=assessGameplayPayload(i);
  assert.equal(partial.referenceFuelKg,5000);assert.equal(partial.fuelIsEstimate,false);
  assert.ok(partial.maximumPayloadKg!<planned.maximumPayloadKg!);
  i.fuelKg=0;const empty=assessGameplayPayload(i);
  assert.equal(empty.maximumPayloadKg,0);
  assert.equal(empty.availableDeltaVMps,0);assert.equal(empty.fuelIsEstimate,false);
  assert.ok(empty.warnings.includes("INSUFFICIENT RETURN FUEL"));
});
test("credits count once and heavier hardware reduces allowance",()=>{
  const i=configuration(),a=assessGameplayPayload(i);
  i.components.push({...i.components[0]});
  assert.equal(assessGameplayPayload(i).totalMassKg,a.totalMassKg);
  i.components.push({id:"container",name:"Container",categoryId:"sample-container",massKg:20,quality:95});
  const credited=assessGameplayPayload(i);
  assert.equal(credited.currentPayloadKg,23);assert.equal(credited.totalMassKg,a.totalMassKg!+20);
  i.components[1].massKg=5000;
  assert.ok(assessGameplayPayload(i).maximumPayloadKg!<credited.maximumPayloadKg!);
});
