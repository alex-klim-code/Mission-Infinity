import { sql } from "kysely";
import { gameDb, requireCondition, type GameConnection } from "./database";
import { isOnline } from "./presence";

export async function resolveUser(authId: string) {
  const user = await gameDb.insertInto("users").values({ auth_id: authId })
    .onConflict(o => o.column("auth_id").doUpdateSet({ auth_id: authId }))
    .returning(["id"]).executeTakeFirstOrThrow();
  return user.id;
}

export async function getPlayer(id: string, db: GameConnection = gameDb) {
  const c = await db.selectFrom("user_characters").selectAll().where("user_id", "=", id).executeTakeFirst();
  return c ? { id, name: c.name, age: c.age, gender: c.gender, presetId: c.preset_id, online: isOnline(id) } : null;
}

export async function requireCharacter(id: string, db: GameConnection = gameDb) {
  const player = await getPlayer(id, db);
  requireCondition(player, 409, "Create your character before beginning a mission.");
  return player;
}

export async function activeMembership(id: string, db: GameConnection = gameDb) {
  return db.selectFrom("game_session_players").selectAll().where("user_id", "=", id).where("active", "=", true).executeTakeFirst();
}

export async function getAccount(id: string) {
  const [character, member] = await Promise.all([getPlayer(id), activeMembership(id)]);
  return { id, character, activeSessionId: member?.session_id ?? null };
}

export async function savePlayer(id: string, input: {name: string; age: number; gender: string; presetId: string}) {
  const name = input.name.trim();
  requireCondition(/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{2,23}$/u.test(name), 400,
    "Use 3–24 letters, numbers, spaces, apostrophes, periods or hyphens.");
  const preset = await gameDb.selectFrom("character_presets").select("id").where("id", "=", input.presetId).executeTakeFirst();
  requireCondition(preset, 400, "Select a valid character appearance.");
  await gameDb.insertInto("user_characters").values({
    user_id: id, name, normalized_name: name.toLowerCase(), age: input.age, gender: input.gender,
    preset_id: input.presetId, updated_at: new Date(),
  }).onConflict(o => o.column("user_id").doUpdateSet({
    name, normalized_name: name.toLowerCase(), age: input.age, gender: input.gender,
    preset_id: input.presetId, updated_at: new Date(),
  })).execute();
  return getPlayer(id);
}

export async function getCareer(id: string) {
  const [user, rows] = await Promise.all([
    gameDb.selectFrom("users").select("created_at").where("id", "=", id).executeTakeFirstOrThrow(),
    gameDb.selectFrom("game_session_players as p").innerJoin("game_sessions as s", "s.id", "p.session_id")
      .select(["s.status", "s.host_id"]).where("p.user_id", "=", id).execute(),
  ]);
  const missionsInitiated = rows.filter(r => r.status === "MISSION_STARTED").length;
  return {
    sessionsCreated: rows.filter(r => r.host_id === id).length,
    missionsInitiated,
    rank: missionsInitiated ? "Mission Leader" : "Aerospace Engineer",
    joinedAt: user.created_at.toISOString(),
  };
}

export async function searchPlayers(id: string, q: string) {
  if (q.trim().length < 2) return [];
  const escaped = q.trim().toLowerCase().replace(/[\\%_]/g, "\\$&");
  const rows = await gameDb.selectFrom("user_characters").select("user_id")
    .where("user_id", "!=", id)
    .where(sql<boolean>`normalized_name like ${`%${escaped}%`} escape '\\'`)
    .orderBy("normalized_name").limit(20).execute();
  const players = await Promise.all(rows.map(r => getPlayer(r.user_id)));
  return players.filter(p => p !== null);
}
