import { gameDb, requireCondition } from "./database";
import { activeMembership, requireCharacter } from "./players";
import { getFriendship } from "./social";
import { ensureAvailable, notifySession, sessionMembers, sessionState } from "./sessions";
import { joinSessionRoom, notifyUsers } from "./presence";

export async function inviteToSession(userId: string, sessionId: string, targetId: string) {
  requireCondition(userId !== targetId, 400, "You cannot invite yourself.");
  await requireCharacter(targetId);
  const friendship = await getFriendship(userId, targetId);
  requireCondition(friendship?.status === "accepted", 403, "You can only invite accepted friends.");
  await gameDb.transaction().execute(async tx => {
    const session = await tx.selectFrom("game_sessions").selectAll()
      .where("id", "=", sessionId).forUpdate().executeTakeFirst();
    requireCondition(session, 404, "Mission session not found.");
    requireCondition(session.status === "LOBBY", 409, "Invitations are only available before the story begins.");
    const members = await sessionMembers(sessionId, tx);
    requireCondition(members.some(m => m.user_id === userId), 403, "Only crew members can invite friends.");
    requireCondition(members.length < 4, 409, "The crew is full.");
    requireCondition(!members.some(m => m.user_id === targetId), 409, "This friend is already in the crew.");
    await tx.updateTable("game_invitations").set({ status: "expired" }).where("session_id", "=", sessionId)
      .where("to_id", "=", targetId).where("status", "=", "pending").where("expires_at", "<=", new Date()).execute();
    const existing = await tx.selectFrom("game_invitations").select("id").where("session_id", "=", sessionId)
      .where("to_id", "=", targetId).where("status", "=", "pending").executeTakeFirst();
    requireCondition(!existing, 409, "An invitation is already pending for this friend.");
    await tx.insertInto("game_invitations").values({
      session_id: sessionId, from_id: userId, to_id: targetId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    }).execute();
  });
  notifyUsers([userId, targetId], "social:changed");
  return { ok: true, message: "Mission invitation sent. It expires in 30 minutes." };
}

export async function respondToInvite(userId: string, invitationId: string, action: "accept" | "decline") {
  const sessionId = await gameDb.transaction().execute(async tx => {
    // User lock makes concurrent accepts across different lobbies safe.
    await tx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().executeTakeFirstOrThrow();
    const pre = await tx.selectFrom("game_invitations").selectAll().where("id", "=", invitationId).executeTakeFirst();
    requireCondition(pre?.to_id === userId, 404, "Invitation not found.");
    const session = await tx.selectFrom("game_sessions").selectAll()
      .where("id", "=", pre.session_id).forUpdate().executeTakeFirstOrThrow();
    const invitation = await tx.selectFrom("game_invitations").selectAll().where("id", "=", invitationId)
      .forUpdate().executeTakeFirstOrThrow();
    const member = await activeMembership(userId, tx);
    if (action === "accept" && invitation.status === "accepted" && member?.session_id === session.id) return session.id;
    requireCondition(invitation.status === "pending", 409, "This invitation has already been answered.");
    requireCondition(invitation.expires_at.getTime() > Date.now(), 410, "This invitation has expired.");
    if (action === "decline") {
      await tx.updateTable("game_invitations").set({ status: "declined" }).where("id", "=", invitationId).execute();
      return null;
    }
    requireCondition(session.status === "LOBBY", 409, "The mission has already begun. Late joins are not allowed.");
    await requireCharacter(userId, tx);
    await ensureAvailable(userId, tx);
    const members = await sessionMembers(session.id, tx);
    requireCondition(members.length < 4, 409, "The crew is full. A mission supports up to four players.");
    await tx.insertInto("game_session_players").values({ session_id: session.id, user_id: userId })
      .onConflict(o => o.columns(["session_id", "user_id"]).doUpdateSet({
        active: true, ready: false, continue_ready: false, accepted: false, joined_at: new Date(),
      })).execute();
    await tx.updateTable("game_invitations").set({ status: "accepted" }).where("id", "=", invitationId).execute();
    await tx.updateTable("game_sessions").set(e => ({ revision: e("revision", "+", 1) })).where("id", "=", session.id).execute();
    return session.id;
  });
  const invitation = await gameDb.selectFrom("game_invitations").select(["from_id", "to_id"]).where("id", "=", invitationId).executeTakeFirstOrThrow();
  notifyUsers([invitation.from_id, invitation.to_id], "social:changed");
  if (sessionId) {
    joinSessionRoom(userId, sessionId);
    await notifySession(sessionId);
  }
  return { session: sessionId ? await sessionState(sessionId, userId) : null };
}
