/**
 * Required Field Validator Utility
 *
 * Centralizes the "non-empty string" validation pattern
 * that appears across entities, use cases, and controllers.
 */

/**
 * Throws an error if the value is undefined, null, or an empty string (after trimming).
 *
 * @param value - The value to validate
 * @param fieldName - Human-readable field name for the error message
 * @throws {Error} If the value is empty
 *
 * @example
 * ```typescript
 * requireNonEmpty(dto.title, 'Title');     // OK if title is "My Doc"
 * requireNonEmpty('',        'Title');     // throws Error('Title is required')
 * requireNonEmpty(undefined, 'SectorId');  // throws Error('SectorId is required')
 * ```
 */
export function requireNonEmpty(
  value: string | undefined | null,
  fieldName: string,
): void {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
}
