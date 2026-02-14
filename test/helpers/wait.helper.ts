/**
 * Wait Utilities
 *
 * Provides asynchronous waiting helpers for E2E and integration tests
 * where operations may take time to complete (e.g., document processing).
 *
 * Phase 7.2: E2E Test Helpers and Utilities
 */

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_WAIT_MS = 30_000;

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll a condition function until it returns true or timeout is reached.
 *
 * @param conditionFn - Async function returning true when condition is met
 * @param options - Polling configuration
 * @throws Error if timeout is reached
 *
 * @example
 * ```ts
 * await waitUntil(
 *   async () => {
 *     const source = await repository.findSourceById(id);
 *     return source?.status === 'COMPLETED';
 *   },
 *   { maxWaitMs: 10000, label: 'document processing' },
 * );
 * ```
 */
export async function waitUntil(
  conditionFn: () => Promise<boolean>,
  options: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
    label?: string;
  } = {},
): Promise<void> {
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const label = options.label ?? 'condition';

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await conditionFn();
    if (result) return;
    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timeout waiting for ${label} after ${maxWaitMs}ms`,
  );
}

/**
 * Measure the execution time of an async operation.
 *
 * @returns Object with the result and duration in milliseconds
 *
 * @example
 * ```ts
 * const { result, durationMs } = await measureTime(async () => {
 *   return request(app).get('/api/health').expect(200);
 * });
 * expect(durationMs).toBeLessThan(3000);
 * ```
 */
export async function measureTime<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

