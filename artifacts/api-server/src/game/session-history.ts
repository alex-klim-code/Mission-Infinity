import type { SessionMessage } from "@workspace/api-zod";
import { gameDb, requireCondition, type GameConnection } from "./database";

export function storedMessage(sessionId: string, userId: string, name: string, message: SessionMessage) {
  return {
    id: message.id, session_id: sessionId, user_id: userId, sender_name: name, text: message.text,
    created_at: message.createdAt, expires_at: message.expiresAt,
  };
}

// Recover the last available transmission from the former per-member storage,
// including expired notifications. Expiry controls display, never history retention.
export async function sessionHistory(sessionId: string, db: GameConnection = gameDb, before?: string) {
  const legacy = await db.selectFrom("game_session_players as m")
    .innerJoin("user_characters as c", "c.user_id", "m.user_id")
    .select(["m.user_id", "m.last_message", "c.name"])
    .where("m.session_id", "=", sessionId).where("m.last_message", "is not", null).execute();
  if (legacy.length) {
    await db.insertInto("game_session_messages").values(
      legacy.map(m => storedMessage(sessionId, m.user_id, m.name, m.last_message!)),
    ).onConflict(oc => oc.column("id").doNothing()).execute();
  }
  let query = db.selectFrom("game_session_messages").selectAll().where("session_id", "=", sessionId);
  if (before) {
    const cursor = await db.selectFrom("game_session_messages").select(["id", "created_at"])
      .where("session_id", "=", sessionId).where("id", "=", before).executeTakeFirst();
    requireCondition(cursor, 400, "This message does not belong to the mission history.");
    query = query.where(eb => eb.or([
      eb("created_at", "<", cursor.created_at),
      eb.and([eb("created_at", "=", cursor.created_at), eb("id", "<", cursor.id)]),
    ]));
  }
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(51).execute();
  return {
    hasMore: rows.length > 50,
    messages: rows.slice(0, 50).reverse().map(m => ({
      id: m.id, playerId: m.user_id, name: m.sender_name, text: m.text,
      createdAt: m.created_at.toISOString(), expiresAt: m.expires_at.toISOString(),
    })),
  };
}

export async function getSessionMessages(userId: string, sessionId: string, before?: string) {
  const member = await gameDb.selectFrom("game_session_players").select("id")
    .where("session_id", "=", sessionId).where("user_id", "=", userId)
    .where("active", "=", true).executeTakeFirst();
  requireCondition(member, 403, "You are not a member of this mission.");
  return sessionHistory(sessionId, gameDb, before);
}
