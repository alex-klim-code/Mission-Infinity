import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getGetPlayerQueryKey } from '@workspace/api-client-react';
import { usePlayerAccount } from './use-player-account';
import { invalidateGame, invalidateSocial } from '@/lib/game';
import { createRealtimeRefreshQueue } from '@/lib/realtime-refresh';

export type LinkStatus = 'offline' | 'connecting' | 'online';
const RealtimeContext = createContext<LinkStatus>('offline');

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const qc = useQueryClient();
  const { data: account } = usePlayerAccount();
  const [status, setStatus] = useState<LinkStatus>('offline');
  const accountId = account?.id;

  useEffect(() => {
    if (!isSignedIn || !accountId) {
      setStatus('offline');
      return;
    }
    setStatus('connecting');
    const socket = io(window.location.origin, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });
    let hadConnected = false;
    const refresh = createRealtimeRefreshQueue(
      () => {
        // Session responses already include chat and crew. DEMO plans are keyed
        // by revision and must not be invalidated again on each flight tick.
        void qc.invalidateQueries({ predicate: q =>
          typeof q.queryKey[0] === 'string' && /^\/api\/game\/sessions\/[^/]+$/.test(q.queryKey[0]) },
        { cancelRefetch: false });
      },
      () => { void qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() }, { cancelRefetch: false }); },
    );
    socket.on('connect', () => {
      setStatus('online');
      if (hadConnected) void invalidateGame(qc);
      hadConnected = true;
    });
    socket.on('disconnect', () => setStatus('connecting'));
    socket.on('connect_error', () => setStatus('offline'));
    socket.io.on('reconnect', () => {
      setStatus('online');
      void invalidateGame(qc);
    });
    socket.on('game:changed', () => refresh.enqueue());
    socket.on('social:changed', () => {
      void invalidateSocial(qc);
      void qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() });
    });
    return () => {
      refresh.dispose();
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    };
  }, [isSignedIn, accountId, qc]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}

export function useLinkStatus() {
  return useContext(RealtimeContext);
}
