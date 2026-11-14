import { sql } from "kysely";
import type { InstrumentDiagnostic, MissionJourney } from "@workspace/api-zod";
import { requireCondition, type GameConnection } from "./database";
import { CONSTRUCTION_MS, constructionMonths, drawDiagnostics, flightTelemetry, makeFlightPlan, missionWeather, rocketDesignCost } from "./mission-flight-model";
import { scientificInstruments } from "./scientific-instruments";
import { advanceOperations, makeOperations } from "./lunar-operations-model";
import { lunarPhases, updateLunarOperations } from "./lunar-operations";
import {beginEngineering,finishEngineering} from "./engineering";
import { resolveHardwareHealth } from "./hardware-health";
import { flightDamageAlerts, scheduleFlightDamage } from "./flight-damage";
import { makeLaunchAttempt, repairWeatherLaunch } from "./weather-launch";
import { requireKnownPayloadFeasible } from "./payload-capacity";

const json = <T>(value: T) => sql<T>`${JSON.stringify(value)}::jsonb`;
const INIT_MS = 900, PER_INSTRUMENT_MS = 900;
const fraction = (elapsed: number, total: number) => Math.max(0,Math.min(1,elapsed/total));

export async function journeyState(db: GameConnection, id: string): Promise<MissionJourney> {
  const [row,build,science,fuel,assembly,engineering] = await Promise.all([
    db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_builds").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_science_loadouts").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_fuel_loads").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_engineering").select("state").where("session_id","=",id).executeTakeFirst(),
  ]);
  const now = Date.now();
  const legacy = !!fuel?.opened && (!row || (row.delivered && !row.construction_started_at));
  const cost = row?.construction_cost ?? rocketDesignCost(build?.selected_hull_id??null,assembly?.selections??{});
  const months = row?.construction_months ?? (legacy ? Math.max(12,build?.elapsed_months??0) : constructionMonths(cost));
  const progress = legacy || row?.delivered ? 1 : row?.construction_started_at ? fraction(now-row.construction_started_at.getTime(),CONSTRUCTION_MS) : 0;
  const telemetry = flightTelemetry(row?.plan ?? null,row?.flight_started_at ?? null,now);
  if(!row?.flight_started_at && fuel) {
    telemetry.remainingFuelKg=fuel.loaded_kg;
    telemetry.massKg=(row?.plan?.dryMassKg??0)+fuel.loaded_kg;
  }
  const ids = science?.instrument_ids ?? [];
  const selected = scientificInstruments.filter(i=>ids.includes(i.id));
  const elapsed = row?.diagnostics_started_at ? now-row.diagnostics_started_at.getTime() : -1;
  const duration = INIT_MS+selected.length*PER_INSTRUMENT_MS;
  const complete = elapsed >= duration;
  const diagnostics: InstrumentDiagnostic[] = selected.map((i,index)=>{
    const p = elapsed<0 ? 0 : fraction(elapsed-INIT_MS-index*PER_INSTRUMENT_MS,PER_INSTRUMENT_MS);
    const result = row?.diagnostics.find(d=>d.instrumentId===i.id);
    if (p>=1 && result) return {...result,progress:1};
    return {instrumentId:i.id,name:i.name,quality:i.quality,maxSciencePoints:i.maxSciencePoints,
      status:"UNKNOWN",failure:null,availableSciencePoints:0,progress:p};
  });
  const baseOperations=row?.operations??(row?.phase==="LUNAR_OPERATIONS"?makeOperations(assembly?.selections??{},diagnostics,telemetry.remainingFuelKg):null);
  const operations=baseOperations&&row?.plan?advanceOperations(row.phase,baseOperations,row.plan,now).operations:baseOperations;
  return {
    launchFailure:row?.phase==="LAUNCH_FAILURE"?row.plan?.launchAttempts?.at(-1)??null:null,
    flightAlerts:flightDamageAlerts(row?.plan??null,telemetry.progress,!!row?.flight_started_at),
    construction:{opened:row?.construction_opened ?? false,startedAt:row?.construction_started_at?.toISOString()??null,
      durationMs:CONSTRUCTION_MS,months,cost,progress,elapsedMonths:Math.max(build?.elapsed_months??0,(engineering?.state.elapsedBefore??0)+Math.floor(progress*months)),
      delivered:legacy || !!row?.delivered,legacy},
    phase:row?.phase ?? "NONE",weather:row?.weather??[],briefingDate:row?.briefing_date??null,
    plan:row?.plan?{...row.plan,hardwareChecks:undefined}:null,
    flight:telemetry,operations,diagnostics,diagnosticsComplete:complete,diagnosticsProgress:elapsed<0 ? 0 : fraction(elapsed,duration),
    availableSciencePoints:diagnostics.reduce((sum,i)=>sum+i.availableSciencePoints,0),
    maxSciencePoints:selected.reduce((sum,i)=>sum+i.maxSciencePoints,0),
  };
}

type Session = {id:string;host_id:string;mission_id:string;status:string};
async function ensureJourney(db: GameConnection, id: string) {
  const existing = await db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",id).executeTakeFirst();
  if (existing) return existing;
  const [build,assembly,fuel] = await Promise.all([
    db.selectFrom("game_session_builds").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_rocket_assemblies").selectAll().where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_fuel_loads").selectAll().where("session_id","=",id).executeTakeFirst(),
  ]);
  requireCondition(build && assembly?.completed,409,"Complete the rocket design before advancing the mission.");
  const cost = rocketDesignCost(build.selected_hull_id,assembly.selections);
  await db.insertInto("game_session_mission_journeys").values({
    session_id:id,construction_cost:cost,construction_months:fuel?.opened ? Math.max(12,build.elapsed_months) : constructionMonths(cost),
    delivered:!!fuel?.opened,construction_started_at:null,briefing_date:null,plan:null,flight_started_at:null,diagnostics_started_at:null,
  }).execute();
  return db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",id).executeTakeFirstOrThrow();
}

/** Existing open-fueling button now opens construction first for new saves. */
export async function openConstruction(db: GameConnection, session: Session, userId: string) {
  requireCondition(session.status==="MISSION_STARTED",409,"Start the mission first.");
  requireCondition(session.host_id===userId,403,"Only the Leader can advance the mission.");
  const science = await db.selectFrom("game_session_science_loadouts").select("completed").where("session_id","=",session.id).executeTakeFirst();
  requireCondition(science?.completed,409,"Complete Stage 2 before construction.");
  const row = await ensureJourney(db,session.id);
  requireCondition(row.phase!=="LAUNCH_FAILURE",409,"Repair the weather-damaged rocket before reopening the fuel station.");
  if (row.delivered) {
    await db.insertInto("game_session_fuel_loads").values({session_id:session.id,flowing_at:null,opened:true})
      .onConflict(oc=>oc.column("session_id").doUpdateSet({opened:true})).execute();
  } else await db.updateTable("game_session_mission_journeys").set({construction_opened:true}).where("session_id","=",session.id).execute();
}

// Every action runs under the enclosing session FOR UPDATE lock.
export async function updateJourney(db: GameConnection, session: Session, userId: string, action: string, briefingDate?: string, requestId?:string, launchRandom?:()=>number) {
  requireCondition(session.status==="MISSION_STARTED",409,"Start the mission first.");
  requireCondition(session.host_id===userId,403,"Only the Leader can advance the mission.");
  const row = await ensureJourney(db,session.id);
  if(action==="repair-weather-launch") {
    await repairWeatherLaunch(db,session,userId,requestId);
    return;
  }
  if(action==="launch-flight"&&row.phase==="LAUNCH_FAILURE")return;
  if(action==="journey-tick"&&lunarPhases.includes(row.phase)) {
    await updateLunarOperations(db,session,userId,{action:"journey-tick"});
    return;
  }
  const update = db.updateTable("game_session_mission_journeys").where("session_id","=",session.id);
  const now = new Date();
  if (action==="start-construction") {
    requireCondition(row.construction_opened,409,"Open construction first.");
    if (!row.construction_started_at && !row.delivered) {
      await beginEngineering(db,session,row.construction_months);
      await update.set({construction_started_at:now}).execute();
    }
    return;
  }
  if (action==="journey-tick") {
    if (row.construction_started_at && !row.delivered) {
      const p = fraction(now.getTime()-row.construction_started_at.getTime(),CONSTRUCTION_MS);
      const build = await db.selectFrom("game_session_builds").select("elapsed_months").where("session_id","=",session.id).executeTakeFirstOrThrow();
      const engineering=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",session.id).executeTakeFirst();
      await db.updateTable("game_session_builds").set({elapsed_months:Math.max(build.elapsed_months,(engineering?.state.elapsedBefore??0)+Math.floor(p*row.construction_months))}).where("session_id","=",session.id).execute();
      if (p>=1) {
        if(!await finishEngineering(db,session.id))return;
        await update.set({delivered:true}).execute();
        await db.insertInto("game_session_fuel_loads").values({session_id:session.id,flowing_at:null,opened:true})
          .onConflict(oc=>oc.column("session_id").doUpdateSet({opened:true})).execute();
      }
    }
    if (row.phase==="FLIGHT") {
      const flight = flightTelemetry(row.plan,row.flight_started_at,now.getTime());
      if (flight.maneuver==="FAILED" || flight.maneuver==="COMPLETE")
        await update.set({phase:flight.maneuver==="FAILED" ? "FAILED" : "MOON_ARRIVAL"}).execute();
    }
    return;
  }
  const fuel = await db.selectFrom("game_session_fuel_loads").selectAll().where("session_id","=",session.id).executeTakeFirst();
  requireCondition(fuel?.completed,409,"Confirm the fuel load before the mission briefing.");
  if (action==="open-briefing") {
    if (row.phase!=="NONE") return; // A stale repeat may not rewind the mission.
    const assembly = await db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const build = await db.selectFrom("game_session_builds").select("selected_hull_id").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const science = await db.selectFrom("game_session_science_loadouts").select("instrument_ids").where("session_id","=",session.id).executeTakeFirstOrThrow();
    await requireKnownPayloadFeasible(db,session.id,{instrumentIds:science.instrument_ids,fuelKg:fuel.loaded_kg});
    const plan = {...makeFlightPlan(build.selected_hull_id!,assembly.selections,science.instrument_ids,fuel.loaded_kg),launchAttempts:row.plan?.launchAttempts??[]};
    const lastFailure=plan.launchAttempts.filter(a=>a.failed).at(-1);
    const calendarStart=lastFailure?new Date(Date.parse(`${lastFailure.briefingDate}T00:00:00Z`)+86400000).toISOString().slice(0,10):now.toISOString().slice(0,10);
    await update.set({phase:"ROUTE",plan,weather:json(missionWeather(session.id,calendarStart))}).execute();
    return;
  }
  if (action==="briefing-continue") {
    requireCondition(["ROUTE","CALENDAR"].includes(row.phase),409,"The route briefing is already complete.");
    await update.set({phase:"CALENDAR"}).execute();
    return;
  }
  if (action==="confirm-briefing-date") {
    requireCondition(["CALENDAR","MISSION_DAY"].includes(row.phase),409,"Choose the briefing date before launch.");
    requireCondition(typeof briefingDate==="string" && row.weather.some(d=>d.date===briefingDate),400,"Choose a date from the mission calendar.");
    if (row.phase==="MISSION_DAY") {
      requireCondition(row.briefing_date===briefingDate,409,"The briefing date is already confirmed.");
      return;
    }
    await update.set({phase:"MISSION_DAY",briefing_date:briefingDate}).execute();
    return;
  }
  if (action==="launch-flight") {
    if (row.phase==="FLIGHT") return;
    requireCondition(row.phase==="MISSION_DAY",409,"Confirm the briefing date before launch.");
    requireCondition(row.plan,409,"Complete the flight briefing before launch.");
    await requireKnownPayloadFeasible(db,session.id,{fuelKg:fuel.loaded_kg});
    const assembly=await db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const build=await db.selectFrom("game_session_builds").select(["selected_hull_id","spent"]).where("session_id","=",session.id).executeTakeFirstOrThrow();
    const science=await db.selectFrom("game_session_science_loadouts").select("spent").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const attempts=row.plan.launchAttempts??[];
    const previousRepairs=attempts.reduce((sum,a)=>sum+(a.repairedAt?a.repairCost:0),0);
    const condition=row.weather.find(w=>w.date===row.briefing_date)?.condition??"SUNNY";
    const attempt=makeLaunchAttempt(condition,row.briefing_date!,build.spent-science.spent-fuel.spent-previousRepairs,fuel.loaded_kg,now,launchRandom);
    const launchAttempts=[...attempts,attempt];
    if(attempt.failed) {
      await update.set({phase:"LAUNCH_FAILURE",flight_started_at:null,plan:json({...row.plan,hardwareChecks:undefined,launchAttempts})}).execute();
      await db.updateTable("game_session_fuel_loads").set({opened:false,completed:false,loaded_kg:0,flowing_at:null,connected:false}).where("session_id","=",session.id).execute();
      return;
    }
    const hardwareChecks=row.plan.hardwareChecks??scheduleFlightDamage({...assembly.selections,...(build.selected_hull_id?{"rocket-body":build.selected_hull_id}:{})});
    await update.set({phase:"FLIGHT",flight_started_at:now,plan:json({...row.plan,hardwareChecks,launchAttempts})}).execute();
    return;
  }
  if (action==="check-instruments") {
    if (["DIAGNOSTICS","LUNAR_OPERATIONS"].includes(row.phase)) return;
    const telemetry = flightTelemetry(row.plan,row.flight_started_at,now.getTime());
    requireCondition(row.phase==="MOON_ARRIVAL" || (row.phase==="FLIGHT" && telemetry.maneuver==="COMPLETE"),409,"Reach the Moon before checking instruments.");
    const science = await db.selectFrom("game_session_science_loadouts").select("instrument_ids").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const assembly = await db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const build = await db.selectFrom("game_session_builds").select("selected_hull_id").where("session_id","=",session.id).executeTakeFirstOrThrow();
    const diagnostics = drawDiagnostics(science.instrument_ids);
    const operations = makeOperations(assembly.selections,diagnostics,telemetry.remainingFuelKg);
    if(row.plan?.hardwareChecks)operations.hardwareChecks=row.plan.hardwareChecks;
    resolveHardwareHealth(operations,{...assembly.selections,...(build.selected_hull_id?{"rocket-body":build.selected_hull_id}:{})});
    await update.set({phase:"DIAGNOSTICS",diagnostics_started_at:now,diagnostics:json(diagnostics),operations:json(operations)}).execute();
    return;
  }
  requireCondition(action==="continue-lunar",400,"Unknown journey action.");
  if (row.phase==="LUNAR_OPERATIONS") return;
  requireCondition(row.phase==="DIAGNOSTICS",409,"Run instrument diagnostics first.");
  const duration = INIT_MS+row.diagnostics.length*PER_INSTRUMENT_MS;
  requireCondition(row.diagnostics_started_at && now.getTime()-row.diagnostics_started_at.getTime()>=duration,409,"Wait for instrument diagnostics to finish.");
  await update.set({phase:"LUNAR_OPERATIONS"}).execute();
}
