import type { QueryClient } from '@tanstack/react-query';
import { getGetCareerQueryKey, getGetPlayerQueryKey } from '@workspace/api-client-react';

export function errMsg(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!e) return fallback;
  const anyE = e as { data?: unknown; message?: string; status?: number };
  const d = anyE.data as { error?: string; message?: string } | null | undefined;
  if (d && typeof d === 'object') {
    if (typeof d.error === 'string') return d.error;
    if (typeof d.message === 'string') return d.message;
  }
  if (anyE.status === 401) return 'Your session expired. Please sign in again.';
  return anyE.message || fallback;
}

export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}

const startsWith = (prefix: string) => (q: { queryKey: readonly unknown[] }) =>
  typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(prefix);

export function invalidateSocial(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: startsWith('/api/game/social') });
}
export function invalidateSessions(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: startsWith('/api/game/sessions') });
}
export function invalidateGame(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetCareerQueryKey() }),
    invalidateSessions(qc),
    invalidateSocial(qc),
  ]);
}

export function formatBudget(b: number) {
  const m = b >= 1_000_000 ? b / 1_000_000 : b;
  return `$${Number.isInteger(m) ? m : m.toFixed(1)}M`;
}

export function portraitFor(presetId: string | undefined) {
  const n = presetId?.match(/(\d+)/)?.[1];
  return n ? `/images/portrait-${n.padStart(2, '0')}.png` : '/images/portrait-01.png';
}

export function imgUrl(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const SCENE_STATUS_LABEL: Record<string, string> = {
  LOBBY: 'Crew assembling',
  STORY: 'Story in progress',
  MISSION_BRIEFING: 'Mission briefing',
  MISSION_ACCEPTANCE: 'Awaiting acceptance',
  READY_TO_START: 'Ready to initiate',
  MISSION_STARTED: 'Mission initiated',
  CLOSED: 'Session closed',
};
