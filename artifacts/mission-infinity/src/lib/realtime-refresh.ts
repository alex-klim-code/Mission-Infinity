/** Coalesce room events; continuous telemetry must not refetch profiles per tick.
 * Fixed timers (not a trailing debounce) also guarantee progress under continuous events. */
export function createRealtimeRefreshQueue(refreshSessions: () => void, refreshAccount: () => void) {
  let sessions: ReturnType<typeof setTimeout> | undefined;
  let account: ReturnType<typeof setTimeout> | undefined;
  return {
    enqueue() {
      sessions ??= setTimeout(() => { sessions = undefined; refreshSessions(); }, 1000);
      account ??= setTimeout(() => { account = undefined; refreshAccount(); }, 10_000);
    },
    dispose() {
      clearTimeout(sessions);
      clearTimeout(account);
      sessions = account = undefined;
    },
  };
}
