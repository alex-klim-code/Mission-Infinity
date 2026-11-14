import { requireCondition, type GameConnection } from "./database";
import { componentById, componentCategories } from "./rocket-catalog";
import {guardEngineeringPurchase,prepareRepairConstruction} from "./engineering";
import {effectiveMissionBudget} from "./mission-finance";

export async function assemblyState(db: GameConnection, sessionId: string, activeIds: string[]) {
  const row = await db.selectFrom("game_session_rocket_assemblies").selectAll().where("session_id", "=", sessionId).executeTakeFirst();
  return {
    completed: row?.completed ?? false,
    selections: Object.entries(row?.selections ?? {}).map(([categoryId, optionId]) => ({ categoryId, optionId })),
    proposals: Object.entries(row?.proposals ?? {}).filter(([id]) => activeIds.includes(id))
      .flatMap(([playerId, choices]) => Object.entries(choices).map(([categoryId, optionId]) => ({ playerId,categoryId,optionId }))),
  };
}

// Called under the existing session FOR UPDATE lock: price differences, choices
// and the budget change are committed together, including concurrent retries.
export async function updateAssembly(
  db: GameConnection, session: {id:string;host_id:string;status:string;mission_id:string},
  userId: string, action: string, optionId?: string,acceptedIssueIds:string[]=[],
) {
  requireCondition(session.status === "MISSION_STARTED", 409, "Start the mission before building.");
  await db.insertInto("game_session_rocket_assemblies").values({session_id:session.id})
    .onConflict(oc => oc.column("session_id").doNothing()).execute();
  const assembly = await db.selectFrom("game_session_rocket_assemblies").selectAll().where("session_id","=",session.id).executeTakeFirstOrThrow();
  const leader = session.host_id === userId;
  if (action === "finish-rocket") {
    requireCondition(leader,403,"Only the Leader can finish the rocket.");
    if (assembly.completed) return;
    const build = await db.selectFrom("game_session_builds").selectAll().where("session_id","=",session.id).executeTakeFirst();
    requireCondition(build?.selected_hull_id && componentCategories.every(c => assembly.selections[c.id]),409,"Choose a hull and all 27 component categories first.");
    await db.updateTable("game_session_rocket_assemblies").set({completed:true}).where("session_id","=",session.id).execute();
    await prepareRepairConstruction(db,session.id,assembly.selections);
    return;
  }
  requireCondition(!assembly.completed,409,"The rocket is already built.");
  const option = optionId ? componentById.get(optionId) : undefined;
  requireCondition(option && option.categoryId !== "rocket-body",400,"Choose a valid component.");
  const engineering=await db.selectFrom("game_session_engineering").select("state").where("session_id","=",session.id).executeTakeFirst();
  requireCondition(!engineering?.state.repairing||engineering.state.failedCategoryIds.includes(option.categoryId),409,"Working components are preserved. Replace only the failed components.");
  if (action === "choose-component") {
    await db.updateTable("game_session_rocket_assemblies").set({
      proposals: {...assembly.proposals, [userId]:{...assembly.proposals[userId],[option.categoryId]:option.id}},
    }).where("session_id","=",session.id).execute();
    return;
  }
  requireCondition(action === "confirm-component" && leader,403,"Only the Leader can confirm a component.");
  const oldId = assembly.selections[option.categoryId];
  if (oldId === option.id) return;
  await guardEngineeringPurchase(db,session,{optionId:option.id},acceptedIssueIds);
  const previous = oldId ? componentById.get(oldId) : undefined;
  requireCondition(!oldId || previous,409,"The previously selected part is no longer in the catalog.");
  const build = await db.selectFrom("game_session_builds").selectAll().where("session_id","=",session.id).executeTakeFirst();
  requireCondition(build?.selected_hull_id,409,"Choose and confirm the rocket body first.");
  const budget=await effectiveMissionBudget(db,session);
  const nextSpent = build.spent + option.price - (previous?.price ?? 0);
  requireCondition(nextSpent >= 0 && nextSpent <= budget,409,"The mission budget is insufficient.");
  await db.updateTable("game_session_builds").set({spent:nextSpent}).where("session_id","=",session.id).execute();
  await db.updateTable("game_session_rocket_assemblies").set({selections:{...assembly.selections,[option.categoryId]:option.id}})
    .where("session_id","=",session.id).execute();
}
