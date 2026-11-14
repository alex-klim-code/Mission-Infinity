import { requireCondition, type GameConnection } from "./database";

export const rocketHulls = {
  "falcon-shadow": { name: "Falcon Shadow", price: 500 },
  "titan-explorer": { name: "Titan Explorer", price: 1200 },
  "nova-prime": { name: "Nova Prime", price: 2500 },
} as const;

export async function rocketBuildState(sessionId: string, db: GameConnection, activeIds: string[]) {
  const row = await db.selectFrom("game_session_builds").selectAll().where("session_id", "=", sessionId).executeTakeFirst();
  return {
    screen: row?.screen ?? "INTRO", selectedHullId: row?.selected_hull_id ?? null,
    spent: row?.spent ?? 0, elapsedMonths: row?.elapsed_months ?? 0,
    votes: Object.entries(row?.votes ?? {}).filter(([playerId]) => activeIds.includes(playerId)).map(([playerId, hullId]) => ({ playerId, hullId })),
  };
}

// The caller holds the session row lock, including for concurrent confirmations.
export async function updateRocketBuild(
  db: GameConnection, session: { id: string; status: string; host_id: string; mission_id: string },
  userId: string, action: string, hullId?: string,
) {
  requireCondition(session.status === "MISSION_STARTED", 409, "Start the mission before building the rocket.");
  await db.insertInto("game_session_builds").values({ session_id: session.id, selected_hull_id: null })
    .onConflict(oc => oc.column("session_id").doNothing()).execute();
  const build = await db.selectFrom("game_session_builds").selectAll().where("session_id", "=", session.id).executeTakeFirstOrThrow();
  const leader = userId === session.host_id;
  if (action === "build-next") {
    requireCondition(leader, 403, "Only the Leader can advance the build stage.");
    requireCondition(build.screen !== "HULL_CONFIRMED", 409, "The hull has already been confirmed.");
    await db.updateTable("game_session_builds").set({ screen: "HULL_SELECTION" }).where("session_id", "=", session.id).execute();
    return;
  }
  requireCondition(hullId && Object.hasOwn(rocketHulls, hullId), 400, "Choose a valid rocket hull.");
  if (action === "choose-hull") {
    requireCondition(build.screen === "HULL_SELECTION", 409, "Hull selection is not open.");
    await db.updateTable("game_session_builds").set({ votes: { ...build.votes, [userId]: hullId } })
      .where("session_id", "=", session.id).execute();
    return;
  }
  requireCondition(action === "confirm-hull", 400, "Unknown build action.");
  requireCondition(leader, 403, "Only the Leader can confirm a purchase.");
  if (build.screen === "HULL_CONFIRMED") {
    requireCondition(build.selected_hull_id === hullId, 409, "A different hull has already been purchased.");
    return; // Retry/double click cannot charge the mission twice.
  }
  requireCondition(build.screen === "HULL_SELECTION", 409, "Open hull selection first.");
  const hull = rocketHulls[hullId as keyof typeof rocketHulls];
  const mission = await db.selectFrom("missions").select("definition").where("id", "=", session.mission_id).executeTakeFirstOrThrow();
  const budget = (mission.definition as { budget: number }).budget;
  requireCondition(build.spent + hull.price <= budget, 409, "The mission budget is insufficient.");
  await db.updateTable("game_session_builds").set({
    selected_hull_id: hullId, spent: build.spent + hull.price, screen: "HULL_CONFIRMED",
    // Selecting a shell is only part of design, not completion of its 12 months.
  }).where("session_id", "=", session.id).execute();
}
