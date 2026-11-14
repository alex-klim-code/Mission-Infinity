import { sql } from "kysely";
import { gameDb, requireCondition, type GameConnection } from "./database";
import { isOnline } from "./presence";
import { SaveCharacterBody, type CharacterInput } from "@workspace/api-zod";
import countries from "i18n-iso-countries";
import { resolveAvatar3D } from "./avatars";

export async function resolveUser(authId: string) {
  const user = await gameDb.insertInto("users").values({ auth_id: authId })
    .onConflict(o => o.column("auth_id").doUpdateSet({ auth_id: authId }))
    .returning(["id"]).executeTakeFirstOrThrow();
  return user.id;
}

export async function getPlayer(id: string, db: GameConnection = gameDb) {
  const c = await db.selectFrom("user_characters").selectAll().where("user_id", "=", id).executeTakeFirst();
  return c ? {
    id, name: c.name, age: c.age, gender: c.gender, presetId: c.preset_id,
    countryCode: c.country_code, appearance: c.appearance, avatar3d: c.avatar_3d, online: isOnline(id),
  } : null;
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

export async function savePlayer(id: string, rawInput: CharacterInput) {
  const input = SaveCharacterBody.parse(rawInput);
  const name = input.name.trim();
  requireCondition(/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{2,23}$/u.test(name), 400,
    "Use 3–24 letters, numbers, spaces, apostrophes, periods or hyphens.");
  const existing = await gameDb.selectFrom("user_characters").selectAll().where("user_id", "=", id).executeTakeFirst();
  const presetId = input.presetId ?? existing?.preset_id ?? "engineer-01";
  // Omitted appearance means preserve it, allowing older clients to edit names safely.
  const appearance = input.appearance === undefined ? existing?.appearance ?? null : input.appearance;
  const avatar3d = input.avatar3d === undefined ? existing?.avatar_3d ?? null :
    input.avatar3d === null ? null : await resolveAvatar3D(id, input.avatar3d);
  const countryCode = input.countryCode ?? appearance?.countryCode ?? existing?.country_code ?? (existing ? null : "PL");
  requireCondition(countryCode === null || (/^[A-Z]{2}$/.test(countryCode) && countries.isValid(countryCode)), 400, "Select a valid country.");
  if (avatar3d) requireCondition(avatar3d.gender === input.gender, 400, "Choose the same identity in Avaturn and your personnel file.");
  if (appearance && !avatar3d) {
    requireCondition(appearance.base === input.gender, 400, "Character identity and appearance must match.");
    requireCondition(appearance.countryCode === countryCode, 400, "Character country and uniform flag must match.");
  }
  const preset = await gameDb.selectFrom("character_presets").select("id").where("id", "=", presetId).executeTakeFirst();
  requireCondition(preset, 400, "Select a valid character appearance.");
  const savedRow = await gameDb.insertInto("user_characters").values({
    user_id: id, name, normalized_name: name.toLowerCase(), age: input.age, gender: input.gender,
    preset_id: presetId, country_code: countryCode, appearance, avatar_3d: avatar3d, updated_at: new Date(),
  }).onConflict(o => o.column("user_id").doUpdateSet(eb => ({
    name, normalized_name: name.toLowerCase(), age: input.age, gender: input.gender,
    preset_id: presetId, country_code: countryCode, appearance,
    // An older client must not overwrite a concurrent 3D upgrade with its stale snapshot.
    avatar_3d: input.avatar3d === undefined ? eb.ref("user_characters.avatar_3d") : avatar3d,
    updated_at: new Date(),
  })).where(eb => input.avatar3d === undefined
    ? eb.or([eb("user_characters.avatar_3d", "is", null),
      input.gender === "unspecified" ? eb.val(false) :
        eb(eb.ref("user_characters.avatar_3d", "->>").key("gender"), "=", input.gender)])
    : eb.val(true))).returning("user_id").executeTakeFirst();
  requireCondition(savedRow, 409, "Your profile changed in another window. Reload before changing identity.");
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
