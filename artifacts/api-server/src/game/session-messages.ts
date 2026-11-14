import { randomUUID } from "node:crypto";
import { SendSessionMessageBody } from "@workspace/api-zod";
import { gameDb, requireCondition } from "./database";
import { notifySession, sessionState } from "./sessions";

/** One bounded, short-lived speech bubble per member; no unbounded chat history. */
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
    await tx.updateTable("game_session_players").set({
      last_message: {
        id: randomUUID(), text, createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 12_000).toISOString(),
      },
    }).where("id", "=", member.id).execute();
    await tx.updateTable("game_sessions").set(eb => ({ revision: eb("revision", "+", 1) }))
      .where("id", "=", sessionId).execute();
  });
  await notifySession(sessionId);
  return sessionState(sessionId, userId);
}
