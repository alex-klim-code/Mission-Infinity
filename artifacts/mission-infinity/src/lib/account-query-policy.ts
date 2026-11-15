/** Only connection/server outages are recoverable; never mask rejected sessions or permissions. */
export function isAccountConnectionError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // Browser fetch rejects without an HTTP response.
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  return status === 408 || status === 429 || (typeof status === 'number' && status >= 500 && status <= 599);
}

/** Respect the server's actual rate window instead of retrying into the same limit. */
export function connectionRetryDelay(attempt: number, error?: unknown): number {
  if (error && typeof error === 'object' && (error as { status?: number }).status === 429) {
    const value = (error as { headers?: Headers }).headers?.get('Retry-After');
    const seconds = value ? Number(value) : NaN;
    const delay = Number.isFinite(seconds) ? seconds * 1000 : value ? Date.parse(value) - Date.now() : 30_000;
    return Math.max(1000, Number.isFinite(delay) ? delay : 30_000) + 250;
  }
  return Math.min(500 * 2 ** attempt, 4000);
}

export const accountQueryPolicy = {
  retry: (failures: number, error: unknown) => failures < 6 && isAccountConnectionError(error),
  retryDelay: connectionRetryDelay,
  // Keep a visible error after the bounded startup retries, but recover without a reload
  // when a temporarily unavailable API returns. TanStack pauses this while offline/hidden.
  refetchInterval: (query: { state: { status: string; error: unknown } }) =>
    query.state.status === 'error' && isAccountConnectionError(query.state.error)
      ? Math.max(5000, connectionRetryDelay(0, query.state.error)) : false as const,
};
