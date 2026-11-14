import { sql } from "kysely";
import type { SessionAction } from "@workspace/api-zod";
import { requireCondition, type GameConnection } from "./database";
import { advanceOperations, makeOperations, missionResults, returnFuelRequirement, sites, type JourneyPhase } from "./lunar-operations-model";
import { flightTelemetry } from "./mission-flight-model";

export const lunarPhases:JourneyPhase[]=["LUNAR_OPERATIONS","LANDING","SAMPLE_COLLECTION","LANDING_FAILED","RETURN_FLIGHT","RETURN_FAILED","REENTRY","RECOVERY","RESULTS"];
const json=<T>(v:T)=>sql<T>`${JSON.stringify(v)}::jsonb`;
type Session={id:string;host_id:string;mission_id:string;status:string};

/** Called only inside the existing session lock; all progress and rewards persist together. */
export async function updateLunarOperations(db:GameConnection,session:Session,userId:string,input:Pick<SessionAction,"thrust"|"siteId">&{action:string}) {
  requireCondition(session.status==="MISSION_STARTED",409,"Start the mission first.");
  requireCondition(session.host_id===userId,403,"Only the Leader can control the spacecraft.");
  const row=await db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",session.id).executeTakeFirst();
  requireCondition(row?.plan,409,"Complete the outbound mission briefing first.");
  requireCondition(lunarPhases.includes(row.phase)||row.phase==="FAILED",409,"Complete the lunar instrument diagnostics first.");
  const assembly=await db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",session.id).executeTakeFirstOrThrow();
  const now=Date.now();
  const initial=row.operations??makeOperations(assembly.selections,row.diagnostics,flightTelemetry(row.plan,row.flight_started_at,now).remainingFuelKg);
  const advanced=advanceOperations(row.phase,initial,row.plan,now);
  let phase=advanced.phase;
  const o=advanced.operations;
  const action=input.action;
  if(phase==="RESULTS") {
    requireCondition(["view-results","journey-tick"].includes(action),409,"Mission results are final.");
    return;
  }
  if(action==="start-landing") {
    requireCondition(phase==="LUNAR_OPERATIONS"||o.landing.status==="DESCENDING"||o.landing.status==="LANDED",409,"Lunar landing is not available.");
    if(o.landing.status==="READY") {
      requireCondition(o.hasCamera||o.alternativeNavigation,409,"MISSION AT RISK — No camera or alternative lunar navigation. Landing is blocked.");
      requireCondition(o.components.some(c=>c.categoryId==="lunar-lander")&&o.components.some(c=>c.categoryId==="lunar-descent-engine"),409,"A lander and descent engine are required.");
      phase="LANDING";o.landing.status="DESCENDING";o.returnManeuver="LUNAR_DESCENT";
      o.landing.startedAt=new Date(now).toISOString();o.landing.lastTickAt=o.landing.startedAt;
    }
  }else if(action==="set-landing-thrust") {
    requireCondition(row.phase==="LANDING",409,"Thrust can only be adjusted during lunar descent.");
    requireCondition(typeof input.thrust==="number"&&Number.isFinite(input.thrust)&&input.thrust>=0&&input.thrust<=100,400,"Thrust must be between 0 and 100 percent.");
    // A command already in flight at touchdown must not roll back the landing.
    if(o.landing.status==="DESCENDING")o.landing.thrust=input.thrust;
  }else if(action==="collect-site") {
    requireCondition(phase==="SAMPLE_COLLECTION"&&o.landing.status==="LANDED",409,"Land safely before collecting samples.");
    requireCondition(o.canCollect,409,"Physical sample collector and container are required.");
    requireCondition(input.siteId&&Object.hasOwn(sites,input.siteId),400,"Choose a valid lunar collection site.");
    if(!o.collectedSites.includes(input.siteId)) {
      requireCondition(!o.siteId||o.siteId===input.siteId,409,"Finish the current collection before selecting another site.");
      if(!o.siteId){o.siteId=input.siteId;o.siteStartedAt=new Date(now).toISOString();o.collectionProgress=0;}
    }
  }else if(action==="start-return") {
    requireCondition(o.returnStartedAt||phase==="SAMPLE_COLLECTION"||phase==="LUNAR_OPERATIONS",409,"Return departure is not available.");
    requireCondition(!o.siteId,409,"Finish the current collection before departure.");
    if(!o.returnStartedAt) {
      phase="RETURN_FLIGHT";o.returnStartedAt=new Date(now).toISOString();
      o.returnInitialFuelKg=o.remainingFuelKg;o.returnManeuver="ASCENT";
      const ascentQuality=o.components.find(c=>c.categoryId==="lunar-ascent-system")?.quality??0;
      o.returnRequiredKg=returnFuelRequirement(assembly.selections,o.remainingFuelKg,row.plan.specificImpulseSeconds,o.sampleMassKg);
      if(o.landing.status==="LANDED"&&!ascentQuality) {
        phase="RETURN_FAILED";o.returnManeuver="ASCENT_FAILURE";
        o.failure="ASCENT FAILURE — No lunar ascent system. The spacecraft and samples could not leave the Moon.";
      }
    }
  }else requireCondition(["journey-tick","view-results"].includes(action),400,"Unknown lunar mission action.");
  if(action==="view-results"||(phase==="RECOVERY"&&o.returnManeuver==="LANDED_ON_EARTH")) {
    requireCondition(["FAILED","LANDING_FAILED","RETURN_FAILED"].includes(phase)||(phase==="RECOVERY"&&o.returnManeuver==="LANDED_ON_EARTH"),409,"Finish the mission before viewing results.");
    if(phase==="FAILED") {
      o.failure="OUTBOUND FLIGHT FAILED — Fuel was exhausted before reaching the Moon. No lunar samples were returned.";
      o.missionDay=flightTelemetry(row.plan,row.flight_started_at,now).currentDay;
    }
    const [build,mission]=await Promise.all([
      db.selectFrom("game_session_builds").select("spent").where("session_id","=",session.id).executeTakeFirstOrThrow(),
      db.selectFrom("missions").select("definition").where("id","=",session.mission_id).executeTakeFirstOrThrow(),
    ]);
    o.results=missionResults(o,row.plan,(mission.definition as {budget:number}).budget-build.spent,phase!=="FAILED");
    phase="RESULTS";
  }
  await db.updateTable("game_session_mission_journeys").set({phase,operations:json(o)}).where("session_id","=",session.id).execute();
}
