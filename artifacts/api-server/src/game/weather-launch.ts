import { randomInt, randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { LaunchAttempt } from "@workspace/api-zod";
import { requireCondition, type GameConnection } from "./database";
import { effectiveMissionBudget } from "./mission-finance";
import { fuelSettings } from "./fuel-loads";

export const WEATHER_ABORT_MS=6000;
const json=<T>(value:T)=>sql<T>`${JSON.stringify(value)}::jsonb`;

export function makeLaunchAttempt(
  weather:string, briefingDate:string, partsSpend:number, fuelKg:number, now=new Date(),
  random=()=>randomInt(0,1_000_000)/1_000_000,
):LaunchAttempt {
  const failed=weather==="RAIN"&&random()<0.25;
  const repairBaseCost=Math.max(0,Math.floor(partsSpend));
  return {id:randomUUID(),weather,briefingDate,startedAt:now.toISOString(),failed,
    repairBaseCost,repairCost:failed?Math.ceil(repairBaseCost/2):0,repairedAt:null,initialFuelKg:fuelKg};
}

/** All callers run under the session FOR UPDATE lock, just like purchases. */
export async function repairWeatherLaunch(
  db:GameConnection, session:{id:string;host_id:string;mission_id:string}, userId:string, requestId?:string,
) {
  requireCondition(session.host_id===userId,403,"Only the Leader can authorize rocket repairs.");
  requireCondition(requestId,400,"Provide the failed launch ID to confirm this repair.");
  const row=await db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",session.id).executeTakeFirstOrThrow();
  const attempts=row.plan?.launchAttempts??[];
  const receipt=attempts.find(a=>a.id===requestId);
  requireCondition(receipt?.failed,409,"This failed launch is no longer available for repair.");
  if(receipt.repairedAt)return; // Retrying an old receipt never charges again.
  requireCondition(row.phase==="LAUNCH_FAILURE"&&attempts.at(-1)?.id===requestId,409,"Only the latest failed launch can be repaired.");
  requireCondition(Date.now()-Date.parse(receipt.startedAt)>=WEATHER_ABORT_MS,409,"Wait for the rocket to land and the damage assessment to finish.");
  const build=await db.selectFrom("game_session_builds").select("spent").where("session_id","=",session.id).executeTakeFirstOrThrow();
  const budget=await effectiveMissionBudget(db,session);
  requireCondition(budget-build.spent>=receipt.repairCost,409,"Insufficient mission budget for repairs. Request additional funding before continuing.");
  const repairedAt=new Date().toISOString();
  await db.updateTable("game_session_builds").set({spent:build.spent+receipt.repairCost}).where("session_id","=",session.id).execute();
  await db.updateTable("game_session_fuel_loads").set({
    opened:true,completed:false,connected:false,flowing_at:null,loaded_kg:0,target_kg:fuelSettings.capacityKg,
  }).where("session_id","=",session.id).execute();
  await db.updateTable("game_session_mission_journeys").set({
    phase:"NONE",flight_started_at:null,briefing_date:null,diagnostics_started_at:null,diagnostics:json([]),operations:null,
    plan:json({...row.plan!,hardwareChecks:undefined,launchAttempts:attempts.map(a=>a.id===requestId?{...a,repairedAt}:a)}),
  }).where("session_id","=",session.id).execute();
}
