import { randomBytes } from "node:crypto";
import { gameDb, requireCondition, type GameConnection } from "./database";
import { activeMembership, getPlayer, requireCharacter } from "./players";
import { isOnline, joinSessionRoom, leaveSessionRoom, notifyUsers } from "./presence";
import { getMissionStory } from "./content";

export async function sessionMembers(id: string, db: GameConnection = gameDb) {
  return db.selectFrom("game_session_players").selectAll()
    .where("session_id", "=", id).where("active", "=", true).orderBy("joined_at").orderBy("id").execute();
}
export async function sessionState(id: string, userId: string, db: GameConnection = gameDb) {
  const session = await db.selectFrom("game_sessions").selectAll().where("id", "=", id).executeTakeFirst();
  requireCondition(session, 404, "Mission session not found.");
  const members = await sessionMembers(id, db);
  requireCondition(members.some(m => m.user_id === userId), 403, "You are not a member of this mission.");
  const players = [];
  for (const member of members) {
    const player = await getPlayer(member.user_id, db);
    if (player) players.push({
      player, ready: member.ready, continueReady: member.continue_ready, accepted: member.accepted,
      connected: isOnline(member.user_id),
      lastMessage: member.last_message && Date.parse(member.last_message.expiresAt) > Date.now() ? member.last_message : null,
    });
  }
  return {
    id: session.id, roomCode: session.room_code, hostId: session.host_id, missionId: session.mission_id,
    status: session.status, scene: session.scene, revision: session.revision,
    createdAt: session.created_at.toISOString(), players,
  };
}
export async function notifySession(id: string, extraIds: string[] = []) {
  const members = await sessionMembers(id);
  const ids = [...members.map(m => m.user_id), ...extraIds];
  notifyUsers(ids, "game:changed", id);
}
export async function notifySessionInvites(id: string) {
  const invites = await gameDb.selectFrom("game_invitations").select(["to_id", "from_id"])
    .where("session_id", "=", id).execute();
  notifyUsers(invites.flatMap(i => [i.to_id, i.from_id]), "social:changed");
}

// Call with the user's row already locked. A completed mission can be archived,
// but an active lobby/prologue must be explicitly left first.
export async function ensureAvailable(userId: string, tx: GameConnection) {
  const membership = await activeMembership(userId, tx);
  if (!membership) return;
  const session = await tx.selectFrom("game_sessions").select("status")
    .where("id", "=", membership.session_id).executeTakeFirstOrThrow();
  requireCondition(["MISSION_STARTED", "CLOSED"].includes(session.status), 409,
    "You already have an active mission. Resume it or leave before joining another.");
  await tx.updateTable("game_session_players").set({ active: false })
    .where("id", "=", membership.id).execute();
}

export async function createSession(userId: string, missionId: string, mode: "solo" | "crew") {
  const sessionId = await gameDb.transaction().execute(async tx => {
    await tx.selectFrom("users").select("id").where("id", "=", userId).forUpdate().executeTakeFirstOrThrow();
    await requireCharacter(userId, tx);
    const mission = await tx.selectFrom("missions").select("definition").where("id", "=", missionId).executeTakeFirst();
    requireCondition(mission && (mission.definition as {enabled: boolean}).enabled, 400, "This mission is not available yet.");
    const story = await getMissionStory(missionId, tx);
    await ensureAvailable(userId, tx);
    const session = await tx.insertInto("game_sessions").values({
      room_code: randomBytes(5).toString("hex").toUpperCase(), host_id: userId,
      mission_id: missionId, status: mode === "solo" ? story[0].stage : "LOBBY", scene: story[0].id,
    }).returning("id").executeTakeFirstOrThrow();
    await tx.insertInto("game_session_players").values({
      session_id: session.id, user_id: userId, ready: true,
    }).execute();
    return session.id;
  });
  joinSessionRoom(userId, sessionId);
  await notifySession(sessionId);
  return sessionState(sessionId, userId);
}

async function bump(id: string, tx: GameConnection) {
  await tx.updateTable("game_sessions").set(e => ({ revision: e("revision", "+", 1) })).where("id", "=", id).execute();
}

// Called while the session row is locked. Never progresses with zero online members.
export async function maybeCompleteAcceptance(id: string, tx: GameConnection) {
  const session = await tx.selectFrom("game_sessions").select("status").where("id", "=", id).executeTakeFirst();
  if (session?.status !== "MISSION_ACCEPTANCE") return;
  const members = await sessionMembers(id, tx);
  const connected = members.filter(m => isOnline(m.user_id));
  if (connected.length > 0 && connected.every(m => m.accepted)) {
    await tx.updateTable("game_sessions").set({ status: "READY_TO_START" }).where("id", "=", id).execute();
  }
}

export async function updateSession(userId: string, id: string, input: { action: string; ready?: boolean; expectedScene?: number }) {
  await gameDb.transaction().execute(async tx => {
    const session = await tx.selectFrom("game_sessions").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    requireCondition(session, 404, "Mission session not found.");
    const members = await sessionMembers(id, tx);
    const me = members.find(m => m.user_id === userId);
    requireCondition(me, 403, "You are not a member of this mission.");
    const host = session.host_id === userId;
    const connected = members.filter(m => isOnline(m.user_id));

    if (input.action === "leave") {
      await tx.updateTable("game_session_players").set({ active: false, ready: false }).where("id", "=", me.id).execute();
      const remaining = members.filter(m => m.user_id !== userId);
      if (remaining.length === 0) {
        // Preserve the terminal milestone for career history.
        if (session.status !== "MISSION_STARTED") {
          await tx.updateTable("game_sessions").set({ status: "CLOSED" }).where("id", "=", id).execute();
        }
      } else if (host) {
        const successor = remaining.find(m => isOnline(m.user_id)) ?? remaining[0];
        await tx.updateTable("game_sessions").set({ host_id: successor.user_id }).where("id", "=", id).execute();
      }
      await maybeCompleteAcceptance(id, tx);
    } else if (input.action === "ready") {
      requireCondition(session.status === "LOBBY", 409, "Ready status can only change in the lobby.");
      await requireCharacter(userId, tx);
      await tx.updateTable("game_session_players").set({ ready: input.ready ?? !me.ready }).where("id", "=", me.id).execute();
    } else if (input.action === "start") {
      requireCondition(host, 403, "Only the host can start the introduction.");
      requireCondition(session.status === "LOBBY", 409, "The introduction has already started.");
      requireCondition(members.length >= 1 && members.length <= 4, 409, "The lobby must contain 1–4 players.");
      requireCondition(connected.every(m => m.user_id === userId || m.ready), 409, "All connected crew members must be ready.");
      const mission = await tx.selectFrom("missions").select("definition").where("id", "=", session.mission_id).executeTakeFirst();
      requireCondition(mission && (mission.definition as {enabled: boolean}).enabled, 409, "The mission is unavailable.");
      for (const m of members) await requireCharacter(m.user_id, tx);
      const story = await getMissionStory(session.mission_id, tx);
      await tx.updateTable("game_sessions").set({ status: story[0].stage, scene: story[0].id }).where("id", "=", id).execute();
      await tx.updateTable("game_invitations").set({ status: "expired" })
        .where("session_id", "=", id).where("status", "=", "pending").execute();
    } else if (input.action === "continue-ready") {
      requireCondition(["STORY", "MISSION_BRIEFING"].includes(session.status), 409, "There is no scene to continue.");
      await tx.updateTable("game_session_players").set({ continue_ready: input.ready ?? !me.continue_ready }).where("id", "=", me.id).execute();
    } else if (input.action === "next") {
      requireCondition(host, 403, "Only the host can advance the story.");
      requireCondition(["STORY", "MISSION_BRIEFING"].includes(session.status), 409, "The current scene cannot be advanced.");
      requireCondition(input.expectedScene === session.scene, 409, "The scene changed. Please try again.");
      const story = await getMissionStory(session.mission_id, tx);
      const next = story[story.findIndex(scene => scene.id === session.scene) + 1];
      requireCondition(next, 409, "There is no next scene.");
      await tx.updateTable("game_sessions").set({ scene: next.id, status: next.stage }).where("id", "=", id).execute();
      await tx.updateTable("game_session_players").set({ continue_ready: false }).where("session_id", "=", id).execute();
    } else if (input.action === "accept") {
      requireCondition(["MISSION_ACCEPTANCE", "READY_TO_START"].includes(session.status), 409, "The mission is not ready for acceptance.");
      await tx.updateTable("game_session_players").set({ accepted: true }).where("id", "=", me.id).execute();
      await maybeCompleteAcceptance(id, tx);
    } else if (input.action === "initiate") {
      requireCondition(host, 403, "Only the host can initiate the mission.");
      requireCondition(["MISSION_ACCEPTANCE", "READY_TO_START"].includes(session.status), 409, "The mission is not ready to start.");
      requireCondition(connected.filter(m => m.user_id !== userId).every(m => m.accepted), 409, "Every connected crew member must be ready.");
      await tx.updateTable("game_session_players").set({ accepted: true }).where("id", "=", me.id).execute();
      await tx.updateTable("game_sessions").set({ status: "MISSION_STARTED" }).where("id", "=", id).execute();
    } else {
      requireCondition(false, 400, "Unknown mission action.");
    }
    await bump(id, tx);
  });
  if (input.action === "leave") leaveSessionRoom(userId, id);
  await notifySession(id, [userId]);
  if (input.action === "start" || input.action === "leave") await notifySessionInvites(id);
  return { session: input.action === "leave" ? null : await sessionState(id, userId) };
}

// An absent host has a grace period to reconnect. Explicit leave transfers immediately.
export async function reconcilePresence(userId: string, transferHost = false) {
  const membership = await activeMembership(userId);
  if (!membership) return;
  await gameDb.transaction().execute(async tx => {
    const session = await tx.selectFrom("game_sessions").selectAll()
      .where("id", "=", membership.session_id).forUpdate().executeTakeFirst();
    if (!session || ["CLOSED", "MISSION_STARTED"].includes(session.status)) return;
    const members = await sessionMembers(session.id, tx);
    if (transferHost || !isOnline(session.host_id)) {
      const successor = members.find(m => isOnline(m.user_id));
      if (successor && (transferHost || session.host_id !== userId)) {
        await tx.updateTable("game_sessions").set({ host_id: successor.user_id }).where("id", "=", session.id).execute();
      }
    }
    // Reconnecting unaccepted crew must accept before the final transition.
    if (session.status === "READY_TO_START" && members.some(m => isOnline(m.user_id) && !m.accepted)) {
      await tx.updateTable("game_sessions").set({ status: "MISSION_ACCEPTANCE" }).where("id", "=", session.id).execute();
    }
    await maybeCompleteAcceptance(session.id, tx);
    await bump(session.id, tx);
  });
  await notifySession(membership.session_id);
}
