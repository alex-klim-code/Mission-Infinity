import type { SessionPlayer } from '@workspace/api-client-react';

export type CrewNotice = {
  id: string; playerId: string; name: string; text: string; createdAt: string; expiresAt: string;
};
type NoticePlayer = Pick<SessionPlayer, 'lastMessage'> & { player: Pick<SessionPlayer['player'], 'id' | 'name'> };

export function collectCrewNotices(previous: readonly CrewNotice[], players: readonly NoticePlayer[], now: number, history: readonly CrewNotice[] = []): CrewNotice[] {
  const notices = new Map(previous.filter(n => Date.parse(n.expiresAt) > now).map(n => [n.id, n]));
  for (const message of history) {
    if (Date.parse(message.expiresAt) > now && !notices.has(message.id)) notices.set(message.id, message);
  }
  for (const { player, lastMessage: message } of players) {
    if (message && Date.parse(message.expiresAt) > now && !notices.has(message.id)) {
      notices.set(message.id, { ...message, playerId: player.id, name: player.name });
    }
  }
  return [...notices.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-6);
}
