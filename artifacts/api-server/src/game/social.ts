import { gameDb, requireCondition, type GameConnection } from "./database";
import { getPlayer, requireCharacter, searchPlayers } from "./players";
import { notifyUsers } from "./presence";

export const friendshipPair = (a: string, b: string) => a < b ? [a, b] as const : [b, a] as const;
export async function getFriendship(a: string, b: string, db: GameConnection = gameDb) {
  const [left, right] = friendshipPair(a, b);
  return db.selectFrom("friendships").selectAll()
    .where("left_id", "=", left).where("right_id", "=", right).executeTakeFirst();
}

export async function friendshipAction(id: string, targetId: string, action: string) {
  requireCondition(id !== targetId, 400, "You cannot send a friend request to yourself.");
  await requireCharacter(id);
  await requireCharacter(targetId);
  const [left, right] = friendshipPair(id, targetId);
  await gameDb.transaction().execute(async tx => {
    // Lock pair participants in stable order, including the initial-request race.
    await tx.selectFrom("users").select("id").where("id", "in", [left, right]).orderBy("id").forUpdate().execute();
    const existing = await getFriendship(id, targetId, tx);
    if (action === "send") {
      requireCondition(!existing, 409, existing?.status === "accepted" ? "You are already friends." : "A friend request is already pending.");
      await tx.insertInto("friendships").values({ left_id: left, right_id: right, requested_by: id }).execute();
      return;
    }
    requireCondition(existing, 404, "This friendship or request no longer exists.");
    if (action === "accept" || action === "reject") {
      requireCondition(existing.status === "pending" && existing.requested_by === targetId, 403, "Only the recipient can respond to this request.");
    } else if (action === "cancel") {
      requireCondition(existing.status === "pending" && existing.requested_by === id, 403, "Only the sender can cancel this request.");
    } else {
      requireCondition(action === "remove" && existing.status === "accepted", 409, "There is no friendship to remove.");
    }
    if (action === "accept") {
      await tx.updateTable("friendships").set({ status: "accepted" }).where("id", "=", existing.id).execute();
    } else {
      await tx.deleteFrom("friendships").where("id", "=", existing.id).execute();
    }
  });
  notifyUsers([id, targetId], "social:changed");
  return { ok: true, message: action === "send" ? "Friend request sent." : "Friends list updated." };
}

export async function socialState(id: string, q = "") {
  const edges = await gameDb.selectFrom("friendships").selectAll()
    .where(e => e.or([e("left_id", "=", id), e("right_id", "=", id)])).execute();
  const friends = [], incoming = [], sent = [];
  for (const edge of edges) {
    const player = await getPlayer(edge.left_id === id ? edge.right_id : edge.left_id);
    if (!player) continue;
    if (edge.status === "accepted") friends.push(player);
    else if (edge.requested_by === id) sent.push(player);
    else incoming.push(player);
  }
  const rows = await gameDb.selectFrom("game_invitations as i")
    .innerJoin("game_sessions as s", "s.id", "i.session_id")
    .innerJoin("missions as m", "m.id", "s.mission_id")
    .select(["i.id", "i.session_id", "i.from_id", "i.to_id", "i.expires_at", "i.status", "m.definition"])
    .where(e => e.or([e("i.from_id", "=", id), e("i.to_id", "=", id)]))
    .where("i.status", "=", "pending").where("i.expires_at", ">", new Date())
    .where("s.status", "=", "LOBBY").orderBy("i.created_at", "desc").limit(50).execute();
  const invitations = [];
  for (const row of rows) {
    const [from, to] = await Promise.all([getPlayer(row.from_id), getPlayer(row.to_id)]);
    if (from && to) invitations.push({
      id: row.id, sessionId: row.session_id, from, to,
      missionTitle: (row.definition as {title: string}).title,
      expiresAt: row.expires_at.toISOString(), direction: row.to_id === id ? "incoming" : "outgoing",
      status: row.status,
    });
  }
  return { friends, incoming, sent, search: await searchPlayers(id, q), invitations };
}

export async function notifyPresence(id: string) {
  const edges = await gameDb.selectFrom("friendships").select(["left_id", "right_id"])
    .where("status", "=", "accepted")
    .where(e => e.or([e("left_id", "=", id), e("right_id", "=", id)])).execute();
  notifyUsers([id, ...edges.map(e => e.left_id === id ? e.right_id : e.left_id)], "social:changed");
}
