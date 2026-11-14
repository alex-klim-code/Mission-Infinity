import { randomInt } from "node:crypto";
import type { HardwareCheck, MissionFlightPlan } from "@workspace/api-zod";
import { makeOperations } from "./lunar-operations-model";
import { resolveHardwareHealth } from "./hardware-health";

/** Draw once when the Leader launches; reveal events by server flight progress.
 * These same receipts are reused at the Moon, never a second damage draw. */
export function scheduleFlightDamage(
  selections: Record<string,string>,
  random = () => randomInt(0,1_000_000)/1_000_000,
): HardwareCheck[] {
  const operations=makeOperations(selections,[],0);
  resolveHardwareHealth(operations,selections,random);
  return (operations.hardwareChecks??[]).map(c=>c.status==="DAMAGED"
    ? {...c,detectedAtProgress:0.12+Math.min(0.999999,Math.max(0,random()))*0.68}
    : c);
}

export function flightDamageAlerts(plan: MissionFlightPlan|null,progress:number,started:boolean) {
  if(!started)return [];
  return (plan?.hardwareChecks??[]).filter(c=>c.status==="DAMAGED"&&c.detectedAtProgress!==undefined&&c.detectedAtProgress<=progress)
    .sort((a,b)=>a.detectedAtProgress!-b.detectedAtProgress!);
}
