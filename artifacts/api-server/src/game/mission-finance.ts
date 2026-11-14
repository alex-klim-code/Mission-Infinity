import {randomInt} from "node:crypto";
import type {MissionFinance,SessionAction} from "@workspace/api-zod";
import {requireCondition,type GameConnection} from "./database";
export const FUNDING_REVIEW_MS=10000,MAX_FUNDING_REQUESTS=3;
type Session={id:string;host_id:string;mission_id:string;status:string};
export async function financeState(db:GameConnection,id:string,baseBudget:number):Promise<MissionFinance>{
  const rows=await db.selectFrom("game_session_funding_requests").selectAll().where("session_id","=",id).orderBy("submitted_at").orderBy("id").execute();
  const approvedFunding=rows.reduce((s,r)=>s+(r.decided_at&&r.approved?r.amount:0),0);
  return {baseBudget,totalBudget:baseBudget+approvedFunding,approvedFunding,maxRequests:MAX_FUNDING_REQUESTS,
    requests:rows.map(r=>({id:r.id,amount:r.amount,reason:r.reason,
      status:r.decided_at?(r.approved?"APPROVED":"DENIED"):Date.now()-r.submitted_at.getTime()<3000?"SUBMITTED":"UNDER_REVIEW",
      submittedAt:r.submitted_at.toISOString(),decidedAt:r.decided_at?.toISOString()??null,
      progress:r.decided_at?1:Math.max(0,Math.min(0.99,(Date.now()-r.submitted_at.getTime())/FUNDING_REVIEW_MS))}))};
}
export async function effectiveMissionBudget(db:GameConnection,session:{id:string;mission_id:string}){
  const m=await db.selectFrom("missions").select("definition").where("id","=",session.mission_id).executeTakeFirstOrThrow();
  return (await financeState(db,session.id,(m.definition as {budget:number}).budget)).totalBudget;
}
/** Session FOR UPDATE lock serializes requests and decisions; approval is drawn once and hidden while pending. */
export async function updateFunding(db:GameConnection,session:Session,userId:string,input:Pick<SessionAction,"requestId"|"amount"|"reason">&{action:string},draw=()=>randomInt(2)===1){
  if(input.action==="funding-tick"){
    await db.updateTable("game_session_funding_requests").set({decided_at:new Date()})
      .where("session_id","=",session.id).where("decided_at","is",null)
      .where("submitted_at","<=",new Date(Date.now()-FUNDING_REVIEW_MS)).execute();
    return;
  }
  requireCondition(session.host_id===userId,403,"Only the Leader can request mission funding.");
  requireCondition(session.status==="MISSION_STARTED",409,"Start the mission before requesting funding.");
  requireCondition(typeof input.requestId==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId),400,"Provide a valid funding request ID.");
  requireCondition(Number.isSafeInteger(input.amount)&&input.amount!>=1000000&&input.amount!<=400000000,400,"Request between $1,000,000 and $400,000,000.");
  const reason=typeof input.reason==="string"?input.reason.trim():"";
  requireCondition(reason.length>=10&&reason.length<=600,400,"Explain the reason in 10–600 characters.");
  const existing=await db.selectFrom("game_session_funding_requests").selectAll().where("id","=",input.requestId).executeTakeFirst();
  if(existing){
    requireCondition(existing.session_id===session.id&&existing.user_id===userId&&existing.amount===input.amount&&existing.reason===reason,409,"This request ID was already used for a different application.");
    return;
  }
  const journey=await db.selectFrom("game_session_mission_journeys").select("phase").where("session_id","=",session.id).executeTakeFirst();
  requireCondition(journey?.phase!=="RESULTS",409,"The mission is complete. Funding applications are closed.");
  const requests=await db.selectFrom("game_session_funding_requests").select(["id","decided_at"]).where("session_id","=",session.id).execute();
  requireCondition(requests.length<MAX_FUNDING_REQUESTS,409,"The mission has used all three funding requests.");
  requireCondition(requests.every(r=>r.decided_at),409,"Wait for NASA's decision on the current application.");
  await db.insertInto("game_session_funding_requests").values({id:input.requestId,session_id:session.id,user_id:userId,
    amount:input.amount!,reason,approved:draw(),submitted_at:new Date(),decided_at:null}).execute();
}
