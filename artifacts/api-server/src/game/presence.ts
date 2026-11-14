import type { Server } from "socket.io";

let realtime: Server | undefined;
const connections = new Map<string, Set<string>>();
export function attachRealtime(server: Server) { realtime = server; }
export function isOnline(id: string) { return (connections.get(id)?.size ?? 0) > 0; }
export function markConnected(id: string, socketId: string) {
  const set = connections.get(id) ?? new Set<string>();
  set.add(socketId);
  connections.set(id, set);
}
export function markDisconnected(id: string, socketId: string) {
  const set = connections.get(id);
  set?.delete(socketId);
  if (!set?.size) connections.delete(id);
}
export function notifyUsers(ids: string[], event: "game:changed" | "social:changed", sessionId?: string) {
  realtime?.to([...new Set(ids)].map(id => `user:${id}`)).emit(event, sessionId ? { sessionId } : {});
}
export function joinSessionRoom(userId: string, sessionId: string) {
  realtime?.in(`user:${userId}`).socketsJoin(`session:${sessionId}`);
}
export function leaveSessionRoom(userId: string, sessionId: string) {
  realtime?.in(`user:${userId}`).socketsLeave(`session:${sessionId}`);
}
