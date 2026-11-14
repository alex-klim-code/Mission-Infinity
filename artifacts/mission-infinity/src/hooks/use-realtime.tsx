import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getGetPlayerQueryKey, useGetPlayer } from '@workspace/api-client-react';
import { invalidateGame, invalidateSessions, invalidateSocial } from '@/lib/game';

export type LinkStatus = 'offline' | 'connecting' | 'online';
const RealtimeContext = createContext<LinkStatus>('offline');

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const qc = useQueryClient();
  const { data: account } = useGetPlayer({ query: { enabled: !!isSignedIn, queryKey: getGetPlayerQueryKey() } });
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
    socket.on('game:changed', () => {
      void invalidateSessions(qc);
      void qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() });
    });
    socket.on('social:changed', () => {
      void invalidateSocial(qc);
      void qc.invalidateQueries({ queryKey: getGetPlayerQueryKey() });
    });
    return () => {
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
