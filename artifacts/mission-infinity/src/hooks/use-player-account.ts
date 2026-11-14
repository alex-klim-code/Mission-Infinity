import { useAuth } from '@clerk/react';
import { getGetPlayerQueryKey, useGetPlayer } from '@workspace/api-client-react';
import { accountQueryPolicy } from '@/lib/account-query-policy';

/** All account gates and realtime share one authenticated, user-scoped recovery policy. */
export function usePlayerAccount() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  return useGetPlayer({
    query: {
      ...accountQueryPolicy,
      queryKey: [...getGetPlayerQueryKey(), userId ?? null],
      enabled: isLoaded && !!isSignedIn && !!userId,
    },
    request: { credentials: 'same-origin', headers: { Accept: 'application/json' } },
  });
}
