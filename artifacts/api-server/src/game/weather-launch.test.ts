import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { pool } from "@workspace/db";
import { gameDb } from "./database";
import { seedGameContent } from "./content";
import { savePlayer } from "./players";
import { createSession, sessionState, updateSession } from "./sessions";
import { componentCategories } from "./rocket-catalog";
import { makeFlightPlan } from "./mission-flight-model";
import { updateJourney } from "./mission-journeys";
import { makeLaunchAttempt } from "./weather-launch";

const json=<T>(v:T)=>sql<T>`${JSON.stringify(v)}::jsonb`;

test("rain has exactly 25% weather-abort probability, other days never draw, repair is always half the parts spend",()=>{
  let failed=0;
  for(let i=0;i<100;i++) {
    const a=makeLaunchAttempt("RAIN","2026-11-14",100_000_001,30000,new Date(0),()=>(i+0.5)/100);
    if(a.failed){failed++;assert.equal(a.repairCost,50_000_001);}
  }
  assert.equal(failed,25);
  assert.equal(makeLaunchAttempt("RAIN","2026-11-14",100,30000,new Date(0),()=>0.25).failed,false);
  for(const weather of ["SUNNY","PARTLY_CLOUDY","CLOUDY","STRONG_WIND","STORM"]) {
    assert.equal(makeLaunchAttempt(weather,"2026-11-14",100,30000,new Date(0),()=>{throw new Error("Not a rainy date");}).failed,false);
  }
});

test("weather failure, paid repair and fresh fueling preserve receipts and cannot be bypassed or double charged",async()=>{
  const users:string[]=[];let id:string|undefined;
  try {
    await seedGameContent();
    for(let i=0;i<2;i++){
      const u=await gameDb.insertInto("users").values({auth_id:`weather-test-${randomUUID()}`}).returning("id").executeTakeFirstOrThrow();
      users.push(u.id);
      await savePlayer(u.id,{name:`Rain${u.id.slice(0,8)}`,age:24,gender:"female",presetId:"engineer-01"});
    }
    const host=users[0],s=await createSession(host,"earth-observer","solo");id=s.id;
    const selections=Object.fromEntries(componentCategories.map(c=>[c.id,c.options[0].id]));
    const plan=makeFlightPlan("falcon-shadow",selections,["multispectral-camera"],30000);
    await gameDb.updateTable("game_sessions").set({status:"MISSION_STARTED"}).where("id","=",id).execute();
    await gameDb.insertInto("game_session_players").values({session_id:id,user_id:users[1]}).execute();
    await gameDb.insertInto("game_session_builds").values({session_id:id,selected_hull_id:"falcon-shadow",spent:105240000,elapsed_months:14}).execute();
    await gameDb.insertInto("game_session_rocket_assemblies").values({session_id:id,completed:true,selections:json(selections),proposals:json({})}).execute();
    await gameDb.insertInto("game_session_science_loadouts").values({session_id:id,opened:true,completed:true,instrument_ids:json(["multispectral-camera"]),spent:5000000}).execute();
    await gameDb.insertInto("game_session_fuel_loads").values({session_id:id,opened:true,completed:true,loaded_kg:30000,target_kg:30000,spent:240000,flowing_at:null}).execute();
    await gameDb.insertInto("game_session_mission_journeys").values({session_id:id,delivered:true,phase:"MISSION_DAY",plan,briefing_date:"2026-11-14",weather:json([{date:"2026-11-14",condition:"RAIN"}])}).execute();
    // Inject only the RNG in this fixture; the normal session lock and game code run.
    await gameDb.transaction().execute(async tx=>{
      const room=await tx.selectFrom("game_sessions").selectAll().where("id","=",id!).forUpdate().executeTakeFirstOrThrow();
      await updateJourney(tx,room,host,"launch-flight",undefined,undefined,()=>0);
    });
    const failed=await sessionState(id,host),attempt=failed.journey.launchFailure!;
    assert.equal(failed.journey.phase,"LAUNCH_FAILURE");
    assert.equal(attempt.repairCost,50000000);
    assert.equal(attempt.repairBaseCost,100000000);
    assert.equal(failed.journey.flight.startedAt,null);
    assert.equal(failed.journey.flight.remainingFuelKg,0);
    assert.equal(failed.fueling.loadedKg,0);
    assert.equal(failed.fueling.spent,240000);
    assert.equal(failed.build.spent,105240000);
    await updateSession(host,id,{action:"launch-flight"});
    assert.deepEqual((await sessionState(id,host)).journey.launchFailure,attempt);
    await assert.rejects(updateSession(host,id,{action:"open-fueling"}),/Repair the weather/);
    await assert.rejects(updateSession(host,id,{action:"start-fueling"}),/Open Stage 3/);
    await assert.rejects(updateSession(users[1],id,{action:"repair-weather-launch",requestId:attempt.id}),/Leader/);
    await assert.rejects(updateSession(host,id,{action:"repair-weather-launch",requestId:attempt.id}),/Wait for the rocket/);
    const row=await gameDb.selectFrom("game_session_mission_journeys").select("plan").where("session_id","=",id).executeTakeFirstOrThrow();
    row.plan!.launchAttempts![0].startedAt=new Date(Date.now()-7000).toISOString();
    await gameDb.updateTable("game_session_mission_journeys").set({plan:json(row.plan)}).where("session_id","=",id).execute();
    await gameDb.updateTable("game_session_builds").set({spent:399000000}).where("session_id","=",id).execute();
    await assert.rejects(updateSession(host,id,{action:"repair-weather-launch",requestId:attempt.id}),/Insufficient mission budget/);
    assert.equal((await sessionState(id,host)).build.spent,399000000);
    await gameDb.updateTable("game_session_builds").set({spent:105240000}).where("session_id","=",id).execute();
    await Promise.all([1,2].map(()=>updateSession(host,id!,{action:"repair-weather-launch",requestId:attempt.id})));
    const repaired=await sessionState(id,host);
    assert.equal(repaired.journey.phase,"NONE");
    assert.equal(repaired.build.spent,155240000);
    assert.equal(repaired.build.elapsedMonths,14);
    assert.deepEqual(repaired.assembly,failed.assembly);
    assert.deepEqual({...repaired.science,massLimitKg:null},{...failed.science,massLimitKg:null});
    assert.equal(repaired.science?.massLimitKg,0,"Empty repaired tanks update the capacity reference without changing the receipt.");
    assert.equal(repaired.fueling.loadedKg,0);
    assert.equal(repaired.fueling.completed,false);
    assert.equal(repaired.fueling.opened,true);
    await assert.rejects(updateSession(host,id,{action:"launch-flight"}),/Confirm the fuel/);
    await updateSession(host,id,{action:"set-fuel-target",quantityKg:1000});
    await updateSession(host,id,{action:"connect-fuel-hose"});
    await updateSession(host,id,{action:"start-fueling"});
    await gameDb.updateTable("game_session_fuel_loads").set({flowing_at:new Date(Date.now()-1000)}).where("session_id","=",id).execute();
    await updateSession(host,id,{action:"fuel-tick"});
    await updateSession(host,id,{action:"disconnect-fuel-hose"});
    await updateSession(host,id,{action:"confirm-fuel"});
    const refueled=await sessionState(id,host);
    assert.equal(refueled.fueling.loadedKg,1000);
    assert.equal(refueled.fueling.spent,248000);
    assert.equal(refueled.build.spent,155248000);
    await updateSession(host,id,{action:"open-briefing"});
    const next=await sessionState(id,host);
    assert.equal(next.journey.plan?.launchAttempts?.length,1);
    assert.ok(next.journey.plan?.launchAttempts?.[0].repairedAt);
    assert.equal(next.journey.weather[0].date,"2026-11-15");
    assert.equal(next.journey.plan?.fuelLoadedKg,1000);
    await updateSession(host,id,{action:"repair-weather-launch",requestId:attempt.id});
    assert.equal((await sessionState(id,host)).build.spent,155248000);
    await updateSession(host,id,{action:"briefing-continue"});
    const clear=next.journey.weather.find(w=>w.condition!=="RAIN")!;
    await updateSession(host,id,{action:"confirm-briefing-date",briefingDate:clear.date});
    await updateSession(host,id,{action:"launch-flight"});
    const launched=await sessionState(id,host);
    assert.equal(launched.journey.phase,"FLIGHT");
    assert.equal(launched.journey.plan?.launchAttempts?.length,2);
    assert.equal(launched.journey.plan?.launchAttempts?.[1].repairBaseCost,100000000);
    assert.ok(launched.journey.flight.startedAt);
  } finally {
    if(id)await gameDb.deleteFrom("game_sessions").where("id","=",id).execute();
    if(users.length)await gameDb.deleteFrom("users").where("id","in",users).execute();
    await pool.end();
  }
});
