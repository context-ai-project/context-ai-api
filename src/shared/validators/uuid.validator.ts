/**
 * UUID Validator Utility
 *
 * Centralizes UUID format validation to avoid duplicating
 * the same regex pattern across the codebase.
 *
 * Supports UUID v1–v5 (standard 8-4-4-4-12 hex format).
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether the given string is a valid UUID
 *
 * @param value - The string to validate
 * @returns `true` if the value is a well-formed UUID
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('not-a-uuid');                            // false
 * isValidUUID('  550e8400-e29b-41d4-a716-446655440000 '); // true (after trim)
 * ```
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}
