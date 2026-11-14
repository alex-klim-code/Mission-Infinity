import { requireCondition, type GameConnection } from "./database";

// Explicit gameplay values from the fueling brief, not tank engineering data.
export const fuelSettings = { capacityKg: 30000, pricePerKg: 8, rateKgPerSecond: 1500, fuelType: "RP-1 / LOX (training simulation)" };
const heartbeatLimitMs = 1500;

/** No offline fueling: a missed heartbeat expires the hold after 1.5 seconds. */
export function fuelIncrement(loaded: number, target: number, elapsedMs: number, remaining: number) {
  return Math.max(0, Math.min(target - loaded, Math.floor(Math.max(0, Math.min(heartbeatLimitMs, elapsedMs)) * fuelSettings.rateKgPerSecond / 1000),
    Math.floor(remaining / fuelSettings.pricePerKg)));
}

export async function fuelingState(db: GameConnection, sessionId: string) {
  const row = await db.selectFrom("game_session_fuel_loads").selectAll().where("session_id", "=", sessionId).executeTakeFirst();
  return {
    ...fuelSettings, opened: row?.opened ?? false, completed: row?.completed ?? false,
    connected: row?.connected ?? false, targetKg: row?.target_kg ?? fuelSettings.capacityKg,
    loadedKg: row?.loaded_kg ?? 0, spent: row?.spent ?? 0,
    loading: !!row?.flowing_at && Date.now() - row.flowing_at.getTime() < heartbeatLimitMs,
  };
}

// Caller holds the session lock: progress, receipt and mission budget update atomically.
export async function updateFueling(
  db: GameConnection, session: { id: string; host_id: string; mission_id: string; status: string },
  userId: string, action: string, quantityKg?: number,
) {
  requireCondition(session.status === "MISSION_STARTED", 409, "Start the mission first.");
  requireCondition(session.host_id === userId, 403, "Only the Leader can operate the fuel station.");
  const science = await db.selectFrom("game_session_science_loadouts").select("completed").where("session_id", "=", session.id).executeTakeFirst();
  requireCondition(science?.completed, 409, "Complete Stage 2 before loading fuel.");
  await db.insertInto("game_session_fuel_loads").values({ session_id: session.id, flowing_at: null })
    .onConflict(oc => oc.column("session_id").doNothing()).execute();
  const row = await db.selectFrom("game_session_fuel_loads").selectAll().where("session_id", "=", session.id).executeTakeFirstOrThrow();
  const update = db.updateTable("game_session_fuel_loads").where("session_id", "=", session.id);
  if (action === "open-fueling") {
    await update.set({ opened: true }).execute();
    return;
  }
  requireCondition(row.opened, 409, "Open Stage 3 first.");
  if (row.completed) {
    requireCondition(action === "confirm-fuel" || action === "pause-fueling" || action === "disconnect-fuel-hose", 409, "The fuel load is already confirmed.");
    if (action === "disconnect-fuel-hose") await update.set({ connected: false, flowing_at: null }).execute();
    return;
  }
  if (action === "set-fuel-target") {
    requireCondition(!row.flowing_at || Date.now() - row.flowing_at.getTime() >= heartbeatLimitMs, 409, "Pause fueling before changing the target.");
    requireCondition(Number.isInteger(quantityKg) && quantityKg! >= row.loaded_kg && quantityKg! <= fuelSettings.capacityKg, 400, "Choose a target between the loaded quantity and tank capacity.");
    await update.set({ target_kg: quantityKg!, flowing_at: null }).execute();
    return;
  }
  if (action === "connect-fuel-hose") {
    await update.set({ connected: true }).execute();
    return;
  }
  const build = await db.selectFrom("game_session_builds").selectAll().where("session_id", "=", session.id).executeTakeFirstOrThrow();
  const mission = await db.selectFrom("missions").select("definition").where("id", "=", session.mission_id).executeTakeFirstOrThrow();
  const remaining = (mission.definition as { budget: number }).budget - build.spent;
  if (action === "start-fueling") {
    requireCondition(row.connected, 409, "Connect the fuel hose first.");
    requireCondition(row.target_kg > row.loaded_kg, 409, "Increase the target quantity first.");
    requireCondition(remaining >= fuelSettings.pricePerKg, 409, "The mission budget is insufficient.");
    if (!row.flowing_at || Date.now() - row.flowing_at.getTime() >= heartbeatLimitMs)
      await update.set({ flowing_at: new Date() }).execute();
    return;
  }
  requireCondition(["fuel-tick", "pause-fueling", "disconnect-fuel-hose", "confirm-fuel"].includes(action), 400, "Unknown fuel station action.");
  const now = new Date();
  const increment = row.flowing_at ? fuelIncrement(row.loaded_kg, row.target_kg, now.getTime() - row.flowing_at.getTime(), remaining) : 0;
  const loaded = row.loaded_kg + increment;
  const cost = row.spent + increment * fuelSettings.pricePerKg;
  if (action === "confirm-fuel")
    requireCondition(loaded > 0 && loaded === row.target_kg, 409, "Load the selected fuel quantity before confirming.");
  const continues = action === "fuel-tick" && !!row.flowing_at &&
    now.getTime() - row.flowing_at.getTime() < heartbeatLimitMs && loaded < row.target_kg && remaining - increment * fuelSettings.pricePerKg >= fuelSettings.pricePerKg;
  if (increment) await db.updateTable("game_session_builds").set({ spent: build.spent + increment * fuelSettings.pricePerKg }).where("session_id", "=", session.id).execute();
  await update.set({
    loaded_kg: loaded, spent: cost, flowing_at: continues ? now : null,
    connected: action === "disconnect-fuel-hose" ? false : row.connected,
    completed: action === "confirm-fuel",
  }).execute();
}
