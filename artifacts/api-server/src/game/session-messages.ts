import { randomUUID } from "node:crypto";
import { SendSessionMessageBody } from "@workspace/api-zod";
import { gameDb, requireCondition } from "./database";
import { notifySession, sessionState } from "./sessions";
import { storedMessage } from "./session-history";

/** Persist each transmission atomically; last_message is only a compatibility/rate-limit snapshot. */
export async function sendSessionMessage(userId: string, sessionId: string, raw: unknown) {
  const { text: rawText } = SendSessionMessageBody.parse(raw);
  const text = rawText.trim();
  requireCondition(text.length > 0, 400, "Write a message before transmitting.");
  await gameDb.transaction().execute(async tx => {
    const session = await tx.selectFrom("game_sessions").select(["id", "status"])
      .where("id", "=", sessionId).forUpdate().executeTakeFirst();
    requireCondition(session, 404, "Mission session not found.");
    requireCondition(session.status !== "CLOSED", 409, "This crew channel is closed.");
    const member = await tx.selectFrom("game_session_players").selectAll()
      .where("session_id", "=", sessionId).where("user_id", "=", userId)
      .where("active", "=", true).executeTakeFirst();
    requireCondition(member, 403, "You are not a member of this mission.");
    const now = Date.now();
    requireCondition(!member.last_message || now - Date.parse(member.last_message.createdAt) >= 1500,
      429, "Please wait a moment before sending another message.");
    const sender = await tx.selectFrom("user_characters").select("name")
      .where("user_id", "=", userId).executeTakeFirstOrThrow();
    const message = {
      id: randomUUID(), text, createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 12_000).toISOString(),
    };
    // Preserve an existing legacy transmission before replacing its snapshot.
    if (member.last_message) {
      await tx.insertInto("game_session_messages")
        .values(storedMessage(sessionId, userId, sender.name, member.last_message))
        .onConflict(oc => oc.column("id").doNothing()).execute();
    }
    await tx.insertInto("game_session_messages").values(storedMessage(sessionId, userId, sender.name, message)).execute();
    await tx.updateTable("game_session_players").set({
      last_message: message,
    }).where("id", "=", member.id).execute();
    await tx.updateTable("game_sessions").set(eb => ({ revision: eb("revision", "+", 1) }))
      .where("id", "=", sessionId).execute();
  });
  await notifySession(sessionId);
  return sessionState(sessionId, userId);
}
