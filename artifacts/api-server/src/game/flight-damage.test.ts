import { test } from "node:test";
import assert from "node:assert/strict";
import type { MissionFlightPlan } from "@workspace/api-zod";
import { componentCategories } from "./rocket-catalog";
import { flightDamageAlerts, scheduleFlightDamage } from "./flight-damage";

const selections=Object.fromEntries(componentCategories.map(c=>[c.id,c.options[0].id]));
test("flight damage is scheduled once, revealed only after launch at its saved progress, and can be absent",()=>{
  const checks=scheduleFlightDamage(selections,()=>0);
  assert.ok(checks.length);
  assert.ok(checks.every(c=>c.status==="DAMAGED"&&c.detectedAtProgress===0.12));
  const plan={hardwareChecks:checks} as MissionFlightPlan;
  assert.deepEqual(flightDamageAlerts(plan,1,false),[]);
  assert.deepEqual(flightDamageAlerts(plan,0.119,true),[]);
  assert.equal(flightDamageAlerts(plan,0.12,true).length,checks.length);
  const restored=JSON.parse(JSON.stringify(plan));
  assert.deepEqual(flightDamageAlerts(restored,0.5,true),flightDamageAlerts(plan,0.5,true));
  assert.deepEqual(flightDamageAlerts({hardwareChecks:scheduleFlightDamage(selections,()=>0.999999)} as MissionFlightPlan,1,true),[]);
  assert.deepEqual(flightDamageAlerts(null,1,true),[]);
});
