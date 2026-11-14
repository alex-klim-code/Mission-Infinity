import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { gameDb } from "./database";
import { pool } from "@workspace/db";
import { seedGameContent } from "./content";
import { savePlayer } from "./players";
import { createSession, sessionState, updateSession } from "./sessions";
import { componentCategories } from "./rocket-catalog";
import { makeFlightPlan, drawDiagnostics } from "./mission-flight-model";
import { makeOperations } from "./lunar-operations-model";
const json=<T>(v:T)=>sql<T>`${JSON.stringify(v)}::jsonb`;

test("stages 6–8 preserve receipts, serialize controls, award each site once and persist immutable results",async()=>{
  const users:string[]=[];let id:string|undefined;
  try{
    await seedGameContent();
    for(let i=0;i<2;i++){
      const u=await gameDb.insertInto("users").values({auth_id:`test-only-${randomUUID()}`}).returning("id").executeTakeFirstOrThrow();
      users.push(u.id);
      await savePlayer(u.id,{name:`Lunar ${u.id.slice(0,8)}`,age:24,gender:"female",presetId:"engineer-01"});
    }
    const host=users[0],s=await createSession(host,"earth-observer","solo");id=s.id;
    const readOps=async()=>{const o=(await sessionState(s.id,host)).journey.operations;assert.ok(o);return o;};
    const selections=Object.fromEntries(componentCategories.map(c=>[c.id,c.options.reduce((a,b)=>a.price<b.price?a:b).id]));
    const diagnostics=drawDiagnostics(["panchromatic-camera"],()=>1);
    const plan=makeFlightPlan("falcon-shadow",selections,["panchromatic-camera"],30000);
    await gameDb.updateTable("game_sessions").set({status:"MISSION_STARTED"}).where("id","=",id).execute();
    await gameDb.insertInto("game_session_builds").values({session_id:id,selected_hull_id:"falcon-shadow",spent:150000000,elapsed_months:16}).execute();
    await gameDb.insertInto("game_session_rocket_assemblies").values({session_id:id,completed:true,selections:json(selections),proposals:json({})}).execute();
    await gameDb.insertInto("game_session_science_loadouts").values({session_id:id,opened:true,completed:true,instrument_ids:json(["panchromatic-camera"]),spent:2000000}).execute();
    await gameDb.insertInto("game_session_fuel_loads").values({session_id:id,opened:true,completed:true,loaded_kg:30000,target_kg:30000,spent:240000,flowing_at:null}).execute();
    await gameDb.insertInto("game_session_players").values({session_id:id,user_id:users[1]}).execute();
    await gameDb.insertInto("game_session_mission_journeys").values({
      session_id:id,construction_started_at:null,delivered:true,briefing_date:"2026-11-14",
      plan,flight_started_at:new Date(Date.now()-30000),diagnostics_started_at:new Date(Date.now()-20000),diagnostics:json(diagnostics),phase:"LUNAR_OPERATIONS",
    }).execute();
    const initial=await sessionState(id,host);
    assert.ok(initial.journey.operations);assert.equal(initial.journey.operations.hasCamera,true);
    assert.equal(initial.journey.operations.canCollect,true); // No analyzer aboard.
    await assert.rejects(updateSession(users[1],id,{action:"start-landing"}),/Leader/);
    await assert.rejects(updateSession(host,id,{action:"collect-site",siteId:"regolith"}),/Land safely/);
    await updateSession(host,id,{action:"start-landing"});
    const started=(await readOps()).landing.startedAt;
    await updateSession(host,id,{action:"start-landing"});
    assert.equal((await readOps()).landing.startedAt,started);
    await assert.rejects(updateSession(host,id,{action:"set-landing-thrust",thrust:101}),/between/);
    // Move only this fixture to the final meter; real physics, not a landing bypass.
    let o=(await gameDb.selectFrom("game_session_mission_journeys").select("operations").where("session_id","=",id).executeTakeFirstOrThrow()).operations!;
    o.landing.altitudeM=0.5;o.landing.velocityMps=0.5;o.landing.thrust=0;o.landing.lastTickAt=new Date(Date.now()-1000).toISOString();
    await gameDb.updateTable("game_session_mission_journeys").set({operations:json(o)}).where("session_id","=",id).execute();
    await updateSession(host,id,{action:"set-landing-thrust",thrust:0}); // Late command at touchdown is harmless.
    assert.equal((await sessionState(id,host)).journey.phase,"SAMPLE_COLLECTION");
    for(const siteId of ["regolith","crater","ridge"] as const){
      await Promise.all([1,2].map(()=>updateSession(host,id!,{action:"collect-site",siteId})));
      o=(await gameDb.selectFrom("game_session_mission_journeys").select("operations").where("session_id","=",id).executeTakeFirstOrThrow()).operations!;
      o.siteStartedAt=new Date(Date.now()-9000).toISOString();
      await gameDb.updateTable("game_session_mission_journeys").set({operations:json(o)}).where("session_id","=",id).execute();
      await updateSession(host,id,{action:"journey-tick"});
      await updateSession(host,id,{action:"collect-site",siteId});
    }
    const samples=await readOps();
    assert.equal(samples.collectedSites.length,3);assert.ok(samples.sampleMassKg>=1);assert.equal(samples.scienceEarned,100);
    await updateSession(host,id,{action:"start-return"});
    const returnStart=(await readOps()).returnStartedAt;
    await updateSession(host,id,{action:"start-return"});
    assert.equal((await readOps()).returnStartedAt,returnStart);
    await gameDb.updateTable("game_session_mission_journeys").set({operations:json({...await readOps(),returnStartedAt:new Date(Date.now()-21000).toISOString()})}).where("session_id","=",id).execute();
    await updateSession(host,id,{action:"journey-tick"});
    assert.equal((await sessionState(id,host)).journey.phase,"REENTRY");
    o=(await gameDb.selectFrom("game_session_mission_journeys").select("operations").where("session_id","=",id).executeTakeFirstOrThrow()).operations!;
    o.reentryStartedAt=new Date(Date.now()-13000).toISOString();
    await gameDb.updateTable("game_session_mission_journeys").set({operations:json(o)}).where("session_id","=",id).execute();
    await updateSession(host,id,{action:"journey-tick"});
    assert.equal((await sessionState(id,host)).journey.phase,"RECOVERY");
    o=(await gameDb.selectFrom("game_session_mission_journeys").select("operations").where("session_id","=",id).executeTakeFirstOrThrow()).operations!;
    o.recoveryStartedAt=new Date(Date.now()-7000).toISOString();
    await gameDb.updateTable("game_session_mission_journeys").set({operations:json(o)}).where("session_id","=",id).execute();
    await Promise.all([1,2].map(()=>updateSession(host,id!,{action:"journey-tick"})));
    const result=(await readOps()).results;
    assert.ok(result);
    assert.equal(result.success,true);assert.ok(result.completionPercent<100); // Missing optional instruments.
    assert.equal(result.recoveredSciencePoints,100);assert.equal(result.remainingBudget,250000000);
    await updateSession(host,id,{action:"view-results"});
    assert.deepEqual((await readOps()).results,result);
    await assert.rejects(updateSession(host,id,{action:"collect-site",siteId:"regolith"}),/final/);
    assert.equal((await sessionState(id,host)).build.spent,150000000);
    // Own second branch: fuel-exhaustion remains frozen and results preserve lost samples.
    const failed=makeOperations(selections,diagnostics,1);
    failed.landing.status="LANDED";failed.collectedSites=["regolith"];failed.sampleMassKg=1;failed.scienceEarned=33;
    failed.returnInitialFuelKg=1;failed.returnRequiredKg=1000;failed.returnStartedAt=new Date(Date.now()-21000).toISOString();
    await gameDb.updateTable("game_session_mission_journeys").set({phase:"RETURN_FLIGHT",operations:json(failed)}).where("session_id","=",id).execute();
    await updateSession(host,id,{action:"journey-tick"});
    assert.equal((await sessionState(id,host)).journey.phase,"RETURN_FAILED");
    await updateSession(host,id,{action:"view-results"});
    const lost=(await readOps()).results;
    assert.ok(lost);
    assert.equal(lost.success,false);assert.equal(lost.recoveredSampleMassKg,0);assert.equal(lost.sampleMassKg,1);
  } finally {
    if(id)await gameDb.deleteFrom("game_sessions").where("id","=",id).execute();
    if(users.length)await gameDb.deleteFrom("users").where("id","in",users).execute();
    await pool.end();
  }
});
