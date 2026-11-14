import {test} from "node:test";
import assert from "node:assert/strict";
import type {GameSession} from "@workspace/api-zod";
import {makeDemoPlan,demoPlan} from "./demo-plan";
import {componentById,componentCategories} from "./rocket-catalog";
import {compatibilityIssues} from "./engineering-rules";
import {makeFlightPlan} from "./mission-flight-model";
import {scientificInstruments} from "./scientific-instruments";

const fixture=(budget=400_000_000)=>({
  id:`demo-${budget}`,revision:1,finance:{totalBudget:budget},build:{spent:0,selectedHullId:null},
  assembly:{selections:[],completed:false},
} as unknown as GameSession);
const selections=(ids:string[])=>Object.fromEntries(ids.filter(id=>componentById.get(id)?.categoryId!=="rocket-body").map(id=>[componentById.get(id)!.categoryId,id]));
test("DEMO recommends a complete compatible, fuel-feasible and affordable loadout without changing the session",()=>{
  const s=fixture(),before=JSON.stringify(s);
  const result=makeDemoPlan(s);
  assert.equal(result.feasible,true);
  assert.equal(result.partIds.length,componentCategories.length+1);
  assert.equal(new Set(result.partIds.map(id=>componentById.get(id)!.categoryId)).size,componentCategories.length+1);
  assert.deepEqual(compatibilityIssues(selections(result.partIds),result.instrumentIds),[]);
  assert.ok(result.estimatedTotalSpent<=s.finance!.totalBudget);
  assert.equal(result.remainingBudget,s.finance!.totalBudget-result.estimatedTotalSpent);
  assert.equal(result.fuelReserveCost,240000);
  assert.ok(makeFlightPlan(result.partIds[0],selections(result.partIds),result.instrumentIds,result.recommendedFuelKg).requiredFuelKg<=result.recommendedFuelKg);
  assert.ok(result.instrumentIds.some(id=>id.includes("camera")));
  assert.equal(JSON.stringify(s),before);
  assert.deepEqual(makeDemoPlan(s),result);
});
test("guidance stays consistent through all sequential purchases and preserves the budget for Stage 2 and fuel",()=>{
  const s=fixture(),initial=makeDemoPlan(s);
  const target=selections(initial.partIds);
  s.build!.spent=componentById.get(initial.partIds[0])!.price;
  s.build!.selectedHullId=initial.partIds[0] as NonNullable<GameSession["build"]>["selectedHullId"];
  for(const cat of componentCategories) {
    const id=target[cat.id];
    const p=componentById.get(id)!;
    s.build!.spent+=p.price;
    s.assembly!.selections.push({categoryId:cat.id,optionId:id});
    const next=makeDemoPlan(s);
    assert.equal(next.feasible,true,cat.id);
    assert.ok(next.partIds.includes(id),`DEMO should retain its own previous choice for ${cat.id}`);
    assert.ok(next.estimatedTotalSpent<=s.finance!.totalBudget);
    assert.deepEqual(compatibilityIssues(Object.fromEntries(s.assembly!.selections.map(p=>[p.categoryId,p.optionId])),[]),[]);
  }
  s.assembly!.completed=true;
  const science=makeDemoPlan(s);
  assert.deepEqual(new Set(science.partIds),new Set(initial.partIds));
  const scienceCost=scientificInstruments.filter(i=>science.instrumentIds.includes(i.id)).reduce((sum,i)=>sum+i.price,0);
  assert.equal(science.estimatedTotalSpent,s.build!.spent+scienceCost+science.fuelReserveCost);
});
test("unaffordable plans have no recommended parts and historical spending is never refunded away",()=>{
  const s=fixture(1_000_000),result=makeDemoPlan(s);
  assert.equal(result.feasible,false);
  assert.deepEqual(result.partIds,[]);
  assert.deepEqual(result.instrumentIds,[]);
  const old=fixture();old.build!.spent=360_000_000;old.build!.selectedHullId="nova-prime";
  const expensive=makeDemoPlan(old);
  assert.ok(expensive.estimatedTotalSpent>=old.build!.spent);
  if(expensive.feasible)assert.equal(expensive.partIds[0],"nova-prime");
});
test("repair recommendations retain salvaged parts, and funding invalidates the advisory cache",()=>{
  const s=fixture();
  s.build!.selectedHullId="falcon-shadow";s.build!.spent=90_000_000;
  s.assembly!.selections=componentCategories.filter(c=>!["rocket-body","electrical-power-system"].includes(c.id)).map(c=>({categoryId:c.id,optionId:c.options[0].id}));
  s.engineering={repairing:true,failedCategoryIds:["electrical-power-system"]} as GameSession["engineering"];
  const fixed=makeDemoPlan(s);
  assert.equal(fixed.feasible,true);
  for(const p of s.assembly!.selections)assert.ok(fixed.partIds.includes(p.optionId));
  const poor=fixture(1_000_000);
  assert.equal(demoPlan(poor).feasible,false);
  poor.finance!.totalBudget=400_000_000;
  assert.equal(demoPlan(poor).feasible,true);
});
