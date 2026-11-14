/** Only connection/server outages are recoverable; never mask rejected sessions or permissions. */
export function isAccountConnectionError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // Browser fetch rejects without an HTTP response.
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  return status === 408 || (typeof status === 'number' && status >= 500 && status <= 599);
}

export const accountQueryPolicy = {
  retry: (failures: number, error: unknown) => failures < 6 && isAccountConnectionError(error),
  retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 4000),
  // Keep a visible error after the bounded startup retries, but recover without a reload
  // when a temporarily unavailable API returns. TanStack pauses this while offline/hidden.
  refetchInterval: (query: { state: { status: string; error: unknown } }) =>
    query.state.status === 'error' && isAccountConnectionError(query.state.error) ? 5000 : false as const,
};
