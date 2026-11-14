import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {sql} from "kysely";
const json=<T>(value:T)=>sql<T>`${JSON.stringify(value)}::jsonb`;
import {pool} from "@workspace/db";
import {gameDb} from "./database";
import {seedGameContent} from "./content";
import {savePlayer} from "./players";
import {createSession,sessionState,updateSession} from "./sessions";
import {componentCategories,componentById} from "./rocket-catalog";
import {previewEngineering} from "./engineering";
import {compatibilityIssues} from "./engineering-rules";
import {financeState,updateFunding,FUNDING_REVIEW_MS} from "./mission-finance";
const cheapest=()=>Object.fromEntries(componentCategories.map(c=>[c.id,[...c.options].sort((a,b)=>a.price-b.price)[0].id]));
const strongest=(cat:string)=>[...componentCategories.find(c=>c.id===cat)!.options].sort((a,b)=>(b.quality??0)-(a.quality??0))[0];
async function fixture(){
  const u=await gameDb.insertInto("users").values({auth_id:`test-engineering-${randomUUID()}`}).returning("id").executeTakeFirstOrThrow();
  await savePlayer(u.id,{name:`Engineer ${u.id.slice(0,8)}`,age:24,gender:"female",presetId:"engineer-01"});
  const s=await createSession(u.id,"earth-observer","solo");
  await gameDb.updateTable("game_sessions").set({status:"MISSION_STARTED"}).where("id","=",s.id).execute();
  const selections=cheapest();
  await gameDb.insertInto("game_session_rocket_assemblies").values({session_id:s.id,selections,completed:false}).execute();
  const spent=50000000+Object.values(selections).reduce((sum,id)=>sum+componentById.get(id)!.price,0);
  await gameDb.insertInto("game_session_builds").values({session_id:s.id,screen:"HULL_CONFIRMED",selected_hull_id:"falcon-shadow",spent,elapsed_months:0}).execute();
  return {u,s,selections,spent,async cleanup(){
    await gameDb.deleteFrom("game_sessions").where("id","=",s.id).execute();
    await gameDb.deleteFrom("users").where("id","=",u.id).execute();
  }};
}
test("engineering training rules explain conflicts, support safe alternatives and do not reject unknown chemistry",()=>{
  const selections=cheapest();
  assert.deepEqual(compatibilityIssues(selections,[]),[]);
  const engine=strongest("main-engines");
  selections["main-engines"]=engine.id;
  const issues=compatibilityIssues(selections,[]);
  assert.ok(issues.some(i=>i.repairCategoryId==="fuel-tanks"));
  assert.ok(issues.some(i=>i.repairCategoryId==="rocket-stages"));
  for(const i of issues){
    assert.equal(i.source,"GAME_RULE");
    assert.match(i.message,/training model/);
    assert.ok(i.optionIds.includes(engine.id));
    assert.ok(i.alternatives.length);
    const alternative=i.alternatives[0];
    assert.ok(!compatibilityIssues({...selections,[i.repairCategoryId]:alternative},[]).some(x=>x.repairCategoryId===i.repairCategoryId));
  }
  const sci=["panchromatic-camera","multispectral-camera","lunar-magnetometer","radiation-detector","lunar-spectrometer","subsurface-radar","advanced-sample-analyzer"];
  assert.ok(compatibilityIssues(cheapest(),sci).some(i=>i.id.startsWith("science-power:")));
  assert.ok(!compatibilityIssues({...cheapest(),"electrical-power-system":strongest("electrical-power-system").id},sci).some(i=>i.id.startsWith("science-power:")));
});
test("mission engineering and funding remain transactional and persistent",async t=>{
  await seedGameContent();
  try{
    await t.test("Known incompatibilities require explicit acknowledgement on non-Easy missions too",async()=>{
      const f=await fixture();
      const missionId=`compatibility-test-${randomUUID()}`;
      try{
        const original=await gameDb.selectFrom("missions").selectAll().where("id","=","earth-observer").executeTakeFirstOrThrow();
        await gameDb.insertInto("missions").values({...original,id:missionId,definition:json({...original.definition as object,difficulty:"Hard"})}).execute();
        await gameDb.updateTable("game_sessions").set({mission_id:missionId}).where("id","=",f.s.id).execute();
        const session=await gameDb.selectFrom("game_sessions").selectAll().where("id","=",f.s.id).executeTakeFirstOrThrow();
        const engine=strongest("main-engines");
        const advice=await previewEngineering(gameDb,session,{optionId:engine.id});
        assert.equal(advice.easy,false);assert.ok(advice.issues.length>0);
        await assert.rejects(updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:engine.id}),/Compatibility warning/);
        assert.equal((await sessionState(f.s.id,f.u.id)).build.spent,f.spent);
        await updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:engine.id,acceptedIssueIds:advice.issues.map(i=>i.id)});
        assert.ok((await sessionState(f.s.id,f.u.id)).assembly.selections.some(s=>s.optionId===engine.id));
      }finally{
        await f.cleanup();
        await gameDb.deleteFrom("missions").where("id","=",missionId).execute();
      }
    });
    await t.test("Easy purchase acknowledgement, failed checks, salvage and cumulative repair time",async()=>{
      const f=await fixture();
      try{
        const session=await gameDb.selectFrom("game_sessions").selectAll().where("id","=",f.s.id).executeTakeFirstOrThrow();
        await assert.rejects(previewEngineering(gameDb,session,{instrumentIds:["invented"]}),/valid scientific/);
        const engine=strongest("main-engines"),oldEngine=componentById.get(f.selections["main-engines"])!;
        const advice=await previewEngineering(gameDb,session,{optionId:engine.id});
        assert.equal(advice.easy,true);assert.ok(advice.issues.length>=2);
        assert.ok(advice.issues.every(i=>i.alternatives.every(id=>componentById.get(id)?.categoryId==="main-engines")));
        await assert.rejects(updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:engine.id}),/Compatibility warning/);
        assert.equal((await sessionState(f.s.id,f.u.id)).build.spent,f.spent);
        await assert.rejects(updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:engine.id,acceptedIssueIds:["stale-warning"]}),/Compatibility warning/);
        const input={action:"confirm-component",optionId:engine.id,acceptedIssueIds:advice.issues.map(i=>i.id)};
        await Promise.all([updateSession(f.u.id,f.s.id,input),updateSession(f.u.id,f.s.id,input)]);
        const spent=f.spent+engine.price-oldEngine.price;
        assert.equal((await sessionState(f.s.id,f.u.id)).build.spent,spent);
        // An unrelated purchase must not repeat an already accepted engine warning.
        const unrelated=componentById.get(f.selections.batteries)!;
        assert.equal((await previewEngineering(gameDb,session,{optionId:unrelated.id})).issues.length,0);
        await updateSession(f.u.id,f.s.id,{action:"finish-rocket"});
        await updateSession(f.u.id,f.s.id,{action:"open-science"});
        await updateSession(f.u.id,f.s.id,{action:"purchase-instruments",instrumentIds:["panchromatic-camera"]});
        await updateSession(f.u.id,f.s.id,{action:"open-fueling"});
        await updateSession(f.u.id,f.s.id,{action:"start-construction"});
        await gameDb.updateTable("game_session_mission_journeys").set({construction_started_at:new Date(Date.now()-11000)}).where("session_id","=",f.s.id).execute();
        await updateSession(f.u.id,f.s.id,{action:"journey-tick"});
        let state=await sessionState(f.s.id,f.u.id);
        assert.equal(state.engineering.status,"FAILED");assert.equal(state.journey.construction.delivered,false);
        assert.equal(state.fueling.opened,false);assert.ok(state.engineering.checks.some(c=>c.status==="FAIL"));
        const elapsed=state.build.elapsedMonths,deadline=state.engineering.deadlineMonths;
        assert.equal(elapsed,state.journey.construction.months);
        const failed=[...state.engineering.failedCategoryIds];
        await Promise.all([updateSession(f.u.id,f.s.id,{action:"rebuild-rocket"}),updateSession(f.u.id,f.s.id,{action:"rebuild-rocket"})]);
        state=await sessionState(f.s.id,f.u.id);
        assert.equal(state.engineering.attempt,2);assert.equal(state.build.spent,spent+2000000);assert.equal(state.build.elapsedMonths,elapsed);
        assert.equal(state.science.completed,true);
        const retained=Object.fromEntries(state.assembly.selections.map(x=>[x.categoryId,x.optionId]));
        assert.equal(retained["main-engines"],engine.id);
        assert.equal(state.assembly.selections.length,27-failed.length);
        await assert.rejects(updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:strongest("batteries").id}),/Working components/);
        let replacementTotal=0;
        for(const cat of failed){
          const part=strongest(cat);replacementTotal+=part.price;
          await updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:part.id});
        }
        await Promise.all([updateSession(f.u.id,f.s.id,{action:"finish-rocket"}),updateSession(f.u.id,f.s.id,{action:"finish-rocket"})]);
        state=await sessionState(f.s.id,f.u.id);
        assert.equal(state.build.spent,spent+2000000+replacementTotal,"Broken hardware is not refunded; the purchased camera is retained.");
        assert.equal(state.engineering.deadlineMonths,deadline+state.journey.construction.months,"Extend only once per repair attempt.");
        assert.equal(state.journey.construction.opened,true);
        await updateSession(f.u.id,f.s.id,{action:"start-construction"});
        await gameDb.updateTable("game_session_mission_journeys").set({construction_started_at:new Date(Date.now()-11000)}).where("session_id","=",f.s.id).execute();
        await updateSession(f.u.id,f.s.id,{action:"journey-tick"});
        state=await sessionState(f.s.id,f.u.id);
        assert.equal(state.engineering.status,"PASSED");assert.equal(state.engineering.repairing,false);
        assert.equal(state.journey.construction.delivered,true);assert.equal(state.fueling.opened,true);
        assert.equal(state.build.elapsedMonths,elapsed+state.journey.construction.months);
        assert.equal(state.engineering.history.length,2);
        assert.deepEqual(state.engineering.history.map(h=>h.status),["FAILED","PASSED"]);
        assert.equal(state.build.spent,spent+2000000+replacementTotal);
      }finally{await f.cleanup();}
    });
    await t.test("funding hides the draw, survives retries, settles once and caps concurrent requests at three",async()=>{
      const f=await fixture();let draws=0;
      try{
        const submit=async(id:string,approved:boolean,amount=20000000)=>gameDb.transaction().execute(async tx=>{
          const s=await tx.selectFrom("game_sessions").selectAll().where("id","=",f.s.id).forUpdate().executeTakeFirstOrThrow();
          await updateFunding(tx,s,f.u.id,{action:"request-funding",requestId:id,amount,reason:"Replace damaged integration hardware."},()=>{draws++;return approved;});
        });
        const mature=async()=>{
          await gameDb.updateTable("game_session_funding_requests").set({submitted_at:new Date(Date.now()-FUNDING_REVIEW_MS-1)}).where("session_id","=",f.s.id).where("decided_at","is",null).execute();
          await Promise.all([updateSession(f.u.id,f.s.id,{action:"funding-tick"}),updateSession(f.u.id,f.s.id,{action:"funding-tick"})]);
        };
        const id=randomUUID();
        const rawSession=await gameDb.selectFrom("game_sessions").selectAll().where("id","=",f.s.id).executeTakeFirstOrThrow();
        await assert.rejects(updateFunding(gameDb,rawSession,"not-the-leader",{action:"request-funding",requestId:id,amount:20000000,reason:"Replace damaged integration hardware."}),/Only the Leader/);
        await Promise.all([submit(id,true),submit(id,false)]);
        assert.equal(draws,1,"Transport retries never redraw the decision.");
        let finance=await financeState(gameDb,f.s.id,400000000);
        assert.equal(finance.totalBudget,400000000);assert.equal(finance.requests[0].status,"SUBMITTED");
        assert.equal("approved" in finance.requests[0],false);
        await assert.rejects(submit(randomUUID(),true),/current application/);
        await assert.rejects(submit(id,true,1000000),/different application/);
        await mature();finance=(await sessionState(f.s.id,f.u.id)).finance;
        assert.equal(finance.totalBudget,420000000);assert.equal(finance.requests[0].status,"APPROVED");
        await mature();assert.equal((await sessionState(f.s.id,f.u.id)).finance.totalBudget,420000000);
        // Verify the approved total is actually used by purchases, not just displayed.
        const part=strongest("rocket-stages");
        await gameDb.updateTable("game_session_builds").set({spent:399999999}).where("session_id","=",f.s.id).execute();
        await updateSession(f.u.id,f.s.id,{action:"confirm-component",optionId:part.id});
        assert.ok((await sessionState(f.s.id,f.u.id)).build.spent>400000000);
        const denied=randomUUID();await submit(denied,false);await mature();
        finance=(await sessionState(f.s.id,f.u.id)).finance;
        assert.equal(finance.totalBudget,420000000);assert.equal(finance.requests.find(r=>r.id===denied)?.status,"DENIED");
        const results=await Promise.allSettled([submit(randomUUID(),true,1000000),submit(randomUUID(),true,1000000)]);
        assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
        assert.equal(draws,3);
        await mature();
        finance=(await sessionState(f.s.id,f.u.id)).finance;
        assert.equal(finance.requests.length,3);assert.equal(finance.totalBudget,421000000);
        await assert.rejects(submit(randomUUID(),true),/three funding requests/);
        assert.equal(draws,3);
      }finally{await f.cleanup();}
    });
  }finally{await pool.end();}
});
