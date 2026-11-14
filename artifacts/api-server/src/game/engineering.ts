import {sql} from "kysely";
import type {EngineeringState,EngineeringAdvice,EngineeringPreview} from "@workspace/api-zod";
import {requireCondition,type GameConnection} from "./database";
import {compatibilityIssues,ENGINEERING_DISCLAIMER} from "./engineering-rules";
import {rocketCatalog,componentById} from "./rocket-catalog";
import {constructionMonths,CONSTRUCTION_MS} from "./mission-flight-model";
import {scientificInstruments} from "./scientific-instruments";
const json=<T>(v:T)=>sql<T>`${JSON.stringify(v)}::jsonb`;
type Session={id:string;host_id:string;mission_id:string;status:string};
async function snapshot(db:GameConnection,id:string){
  const [a,s]=await Promise.all([
    db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",id).executeTakeFirst(),
    db.selectFrom("game_session_science_loadouts").select("instrument_ids").where("session_id","=",id).executeTakeFirst(),
  ]);
  return {selections:a?.selections??{},ids:s?.instrument_ids??[]};
}
export async function previewEngineering(db:GameConnection,session:Session,input:EngineeringPreview):Promise<EngineeringAdvice>{
  if(input.instrumentIds!==undefined)requireCondition(input.instrumentIds.length<=7&&new Set(input.instrumentIds).size===input.instrumentIds.length&&input.instrumentIds.every(id=>scientificInstruments.some(i=>i.id===id)),400,"Choose a unique list of valid scientific instruments.");
  const {selections,ids}=await snapshot(db,session.id);
  const m=await db.selectFrom("missions").select("definition").where("id","=",session.mission_id).executeTakeFirstOrThrow();
  const easy=(m.definition as {difficulty:string}).difficulty.toLowerCase()==="easy";
  let category:string|undefined;
  if(input.optionId){
    const c=componentById.get(input.optionId);requireCondition(c,400,"Choose a valid component.");
    selections[c.categoryId]=c.id;category=c.categoryId;
  }
  let issues=compatibilityIssues(selections,input.instrumentIds??ids)
    .filter(i=>category?i.categoryIds.includes(category):input.instrumentIds!==undefined?i.id.startsWith("science-power:"):true);
  if(category)issues=issues.map(issue=>({...issue,alternatives:(rocketCatalog.flatMap(s=>s.categories).find(c=>c.id===category)?.options??[])
    .filter(o=>o.id!==input.optionId&&!compatibilityIssues({...selections,[category!]:o.id},ids).some(i=>i.categoryIds.includes(category!)))
    .sort((a,b)=>a.price-b.price).map(o=>o.id)}));
  return {easy,issues,disclaimer:ENGINEERING_DISCLAIMER};
}
export async function guardEngineeringPurchase(db:GameConnection,session:Session,input:EngineeringPreview,acceptedIssueIds:string[]=[]){
  const advice=await previewEngineering(db,session,input);
  requireCondition(advice.issues.every(i=>acceptedIssueIds.includes(i.id)),409,"Compatibility warning: review the current design and explicitly accept every risk before purchasing.");
}
export async function engineeringState(db:GameConnection,id:string,deadline:number):Promise<EngineeringState>{
  const row=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",id).executeTakeFirst();
  const state:EngineeringState=row?.state??{status:"DESIGN",attempt:1,repairing:false,failedCategoryIds:[],elapsedBefore:0,
    deadlineMonths:deadline,issues:[],checks:[],history:[]};
  if(state.status!=="BUILDING")return state;
  const j=await db.selectFrom("game_session_mission_journeys").select("construction_started_at").where("session_id","=",id).executeTakeFirst();
  const p=j?.construction_started_at?Math.min(1,(Date.now()-j.construction_started_at.getTime())/CONSTRUCTION_MS):0;
  return {...state,checks:state.checks.map((c,index)=>({...c,status:p<(index+1)/state.checks.length?"PENDING":state.issues.some(i=>rocketCatalog.find(s=>s.id===c.id)?.categories.some(cat=>cat.id===i.repairCategoryId))?"FAIL":"DONE"}))};
}
async function saveState(db:GameConnection,id:string,state:EngineeringState){
  await db.insertInto("game_session_engineering").values({session_id:id,state:json(state)})
    .onConflict(oc=>oc.column("session_id").doUpdateSet({state:json(state)})).execute();
}
export async function beginEngineering(db:GameConnection,session:Session,months:number){
  const m=await db.selectFrom("missions").select("definition").where("id","=",session.mission_id).executeTakeFirstOrThrow();
  const state=await engineeringState(db,session.id,(m.definition as {developmentMonths:number}).developmentMonths);
  requireCondition(state.status!=="FAILED",409,"Rebuild the failed rocket before starting another attempt.");
  if(state.status==="BUILDING"||state.status==="PASSED")return;
  const {selections,ids}=await snapshot(db,session.id);
  const issues=compatibilityIssues(selections,ids);
  state.status="BUILDING";state.issues=issues;
  state.checks=rocketCatalog.map(s=>({id:s.id,label:s.name,status:"PENDING",message:issues.filter(i=>s.categories.some(c=>c.id===i.repairCategoryId)).map(i=>i.message).join(" ")||"Integration check passed."}));
  state.history.push({number:state.attempt,status:"BUILDING",months,elapsedBefore:state.elapsedBefore,issues});
  await saveState(db,session.id,state);
}
export async function finishEngineering(db:GameConnection,id:string):Promise<boolean>{
  const row=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",id).executeTakeFirst();
  if(!row)return true; // Already-running legacy construction is not retroactively failed.
  const s=row.state;
  if(s.status==="FAILED")return false;
  if(s.status!=="BUILDING")return true;
  s.status=s.issues.length?"FAILED":"PASSED";s.repairing=s.status==="FAILED"?s.repairing:false;
  s.failedCategoryIds=[...new Set(s.issues.map(i=>i.repairCategoryId))];
  s.checks=s.checks.map(c=>({...c,status:s.issues.some(i=>rocketCatalog.find(x=>x.id===c.id)?.categories.some(cat=>cat.id===i.repairCategoryId))?"FAIL":"DONE"}));
  s.history=s.history.map(h=>h.number===s.attempt?{...h,status:s.status==="FAILED"?"FAILED":"PASSED"}:h);
  await saveState(db,id,s);return s.status==="PASSED";
}
export async function rebuildRocket(db:GameConnection,session:Session,userId:string){
  requireCondition(session.host_id===userId,403,"Only the Leader can rebuild the rocket.");
  const row=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",session.id).executeTakeFirst();
  requireCondition(row,409,"No failed construction attempt is available.");
  if(row.state.repairing&&row.state.status==="DESIGN")return;
  requireCondition(row.state.status==="FAILED",409,"Only a failed construction attempt can be rebuilt.");
  const j=await db.selectFrom("game_session_mission_journeys").selectAll().where("session_id","=",session.id).executeTakeFirstOrThrow();
  requireCondition(j.phase==="NONE"&&!j.delivered,409,"An active flight cannot be rebuilt.");
  const a=await db.selectFrom("game_session_rocket_assemblies").select("selections").where("session_id","=",session.id).executeTakeFirstOrThrow();
  const b=await db.selectFrom("game_session_builds").select("elapsed_months").where("session_id","=",session.id).executeTakeFirstOrThrow();
  const selections={...a.selections};
  for(const cat of row.state.failedCategoryIds)delete selections[cat];
  await db.updateTable("game_session_rocket_assemblies").set({completed:false,selections:json(selections),proposals:json({})}).where("session_id","=",session.id).execute();
  await db.updateTable("game_session_mission_journeys").set({construction_opened:false,construction_started_at:null,construction_cost:0,delivered:false}).where("session_id","=",session.id).execute();
  await saveState(db,session.id,{...row.state,status:"DESIGN",attempt:row.state.attempt+1,repairing:true,elapsedBefore:b.elapsed_months,issues:[],checks:[]});
}
export async function prepareRepairConstruction(db:GameConnection,id:string,selections:Record<string,string>){
  const row=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",id).executeTakeFirst();
  if(!row?.state.repairing)return;
  const cost=row.state.failedCategoryIds.reduce((sum,cat)=>sum+(componentById.get(selections[cat])?.price??0),0);
  const months=constructionMonths(cost);
  await db.updateTable("game_session_mission_journeys").set({construction_cost:cost,construction_months:months,construction_opened:true}).where("session_id","=",id).execute();
  await saveState(db,id,{...row.state,deadlineMonths:row.state.deadlineMonths+months});
}
