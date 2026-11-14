import { requireCondition, type GameConnection } from "./database";
import { scientificInstruments } from "./scientific-instruments";
import { sql } from "kysely";
import {guardEngineeringPurchase} from "./engineering";
import {effectiveMissionBudget} from "./mission-finance";

export async function scienceState(db: GameConnection, sessionId: string, activeIds: string[]) {
  const row = await db.selectFrom("game_session_science_loadouts").selectAll().where("session_id", "=", sessionId).executeTakeFirst();
  return {
    opened: row?.opened ?? false, completed: row?.completed ?? false,
    instrumentIds: row?.instrument_ids ?? [], spent: row?.spent ?? 0,
    proposals: Object.entries(row?.proposals ?? {}).filter(([id]) => activeIds.includes(id))
      .map(([playerId, instrumentIds]) => ({ playerId, instrumentIds })),
  };
}

// Caller holds the session FOR UPDATE lock. Selection, receipt and budget are atomic.
export async function updateScience(
  db: GameConnection, session: { id: string; host_id: string; mission_id: string; status: string },
  userId: string, action: string, instrumentIds?: string[],acceptedIssueIds:string[]=[],
) {
  requireCondition(session.status === "MISSION_STARTED", 409, "Start the mission first.");
  const assembly = await db.selectFrom("game_session_rocket_assemblies").select("completed").where("session_id", "=", session.id).executeTakeFirst();
  requireCondition(assembly?.completed, 409, "Complete Stage 1 before selecting scientific instruments.");
  const leader = userId === session.host_id;
  await db.insertInto("game_session_science_loadouts").values({ session_id: session.id })
    .onConflict(oc => oc.column("session_id").doNothing()).execute();
  const loadout = await db.selectFrom("game_session_science_loadouts").selectAll().where("session_id", "=", session.id).executeTakeFirstOrThrow();
  if (action === "open-science") {
    requireCondition(leader, 403, "Only the Leader can advance to Stage 2.");
    await db.updateTable("game_session_science_loadouts").set({ opened: true }).where("session_id", "=", session.id).execute();
    return;
  }
  requireCondition(loadout.opened, 409, "Open Stage 2 first.");
  requireCondition(Array.isArray(instrumentIds) && instrumentIds.length <= 7 &&
    new Set(instrumentIds).size === instrumentIds.length &&
    instrumentIds.every(id => scientificInstruments.some(item => item.id === id)), 400, "Choose valid, unique scientific instruments.");
  const ids = scientificInstruments.filter(item => instrumentIds.includes(item.id)).map(item => item.id);
  if (action === "propose-instruments") {
    requireCondition(!loadout.completed, 409, "The scientific loadout is already purchased.");
    await db.updateTable("game_session_science_loadouts").set({ proposals: { ...loadout.proposals, [userId]: ids } })
      .where("session_id", "=", session.id).execute();
    return;
  }
  requireCondition(action === "purchase-instruments" && leader, 403, "Only the Leader can purchase scientific instruments.");
  if (loadout.completed) {
    requireCondition(JSON.stringify(ids) === JSON.stringify(loadout.instrument_ids), 409, "The scientific loadout is already purchased.");
    return; // Retry cannot charge twice, including the empty loadout.
  }
  const cost = scientificInstruments.filter(item => ids.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  const build = await db.selectFrom("game_session_builds").selectAll().where("session_id", "=", session.id).executeTakeFirstOrThrow();
  const budget=await effectiveMissionBudget(db,session);
  requireCondition(build.spent + cost <= budget, 409, "The mission budget is insufficient.");
  await guardEngineeringPurchase(db,session,{instrumentIds:ids},acceptedIssueIds);
  await db.updateTable("game_session_builds").set({ spent: build.spent + cost }).where("session_id", "=", session.id).execute();
  await db.updateTable("game_session_science_loadouts").set({ completed: true, instrument_ids: sql<string[]>`${JSON.stringify(ids)}::jsonb`, spent: cost })
    .where("session_id", "=", session.id).execute();
}
