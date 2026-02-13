/**
 * Error Handling Utilities
 *
 * Centralizes the repeated error-extraction pattern that appears
 * across controllers, services, and use cases.
 */

/**
 * Extracts a human-readable message from an unknown error.
 *
 * @param error - The caught error (typically `unknown`)
 * @returns The error message string, or `'Unknown error'` as fallback
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error: unknown) {
 *   logger.error(`Operation failed: ${extractErrorMessage(error)}`);
 * }
 * ```
 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Extracts the stack trace from an unknown error.
 *
 * @param error - The caught error (typically `unknown`)
 * @returns The stack trace string, or `undefined` if not available
 */
export function extractErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
