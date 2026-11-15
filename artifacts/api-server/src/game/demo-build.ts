import type { GameSession } from "@workspace/api-zod";
import { requireCondition, type GameConnection } from "./database";
import { makeDemoPlan } from "./demo-plan";
import { componentById, componentCategories } from "./rocket-catalog";
import { compatibilityIssues } from "./engineering-rules";
import { updateAssembly } from "./rocket-assemblies";

/** Caller holds the session lock. Purchase the whole compatible design atomically,
 * never a sequence of possibly incompatible intermediate designs. */
export async function buildDemoRocket(
  db:GameConnection,session:{id:string;host_id:string;mission_id:string;status:string},
  userId:string,state:GameSession,
) {
  requireCondition(session.host_id===userId,403,"Only the Leader can build the recommended rocket.");
  requireCondition(session.status==="MISSION_STARTED",409,"Start the mission before building.");
  if(state.assembly?.completed)return; // Concurrent clicks/retries never charge twice.
  const repairing=!!state.engineering?.repairing;
  requireCondition((state.journey?.phase??"NONE")==="NONE"&&!state.fueling?.opened
    &&(!state.journey?.construction.opened||repairing)&&(!state.science?.opened||repairing),
    409,"The rocket can only be configured during Rocket Construction.");
  const plan=makeDemoPlan(state);
  requireCondition(plan.feasible,409,"No recommended rocket fits the remaining budget and existing parts.");
  const hull=componentById.get(plan.partIds[0]);
  requireCondition(hull?.categoryId==="rocket-body",409,"The recommended hull is unavailable.");
  const chosen=Object.fromEntries(plan.partIds.slice(1).map(id=>{
    const part=componentById.get(id);
    requireCondition(part,409,"A recommended component is unavailable.");
    return [part.categoryId,part.id];
  }));
  requireCondition(componentCategories.every(c=>chosen[c.id]),409,"The recommended rocket is incomplete.");
  const instruments=[...new Set([...(state.science?.instrumentIds??[]),...plan.instrumentIds])];
  requireCondition(compatibilityIssues(chosen,instruments).length===0,409,"The recommended design is incompatible.");
  const previous=Object.fromEntries((state.assembly?.selections??[]).map(s=>[s.categoryId,s.optionId]));
  let additional=state.build?.selectedHullId?0:hull.price;
  for(const [category,id] of Object.entries(chosen)){
    if(previous[category]===id)continue;
    const old=componentById.get(previous[category]);
    requireCondition(!previous[category]||old,409,"A previously purchased component is unavailable.");
    additional+=componentById.get(id)!.price-(repairing?0:(old?.price??0));
  }
  const spent=(state.build?.spent??0)+additional;
  requireCondition(spent>=0&&spent<=(state.finance?.totalBudget??0),409,"The mission budget is insufficient.");
  await db.insertInto("game_session_builds").values({session_id:session.id,selected_hull_id:hull.id,screen:"HULL_CONFIRMED",spent})
    .onConflict(oc=>oc.column("session_id").doUpdateSet({selected_hull_id:hull.id,screen:"HULL_CONFIRMED",spent})).execute();
  await db.insertInto("game_session_rocket_assemblies").values({session_id:session.id,selections:chosen,proposals:{},completed:false})
    .onConflict(oc=>oc.column("session_id").doUpdateSet({selections:chosen,proposals:{},completed:false})).execute();
  await updateAssembly(db,session,userId,"finish-rocket");
}
