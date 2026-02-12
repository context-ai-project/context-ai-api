/**
 * Auth Test Helper
 *
 * Provides authentication utilities for E2E tests.
 * Manages mock JWT tokens mapped to predefined user fixtures.
 *
 * Phase 7.2: E2E Test Helpers and Utilities
 */

/**
 * Token mapping for test auth guard.
 * These constants should match the tokens recognized by
 * the TestJwtAuthGuard in E2E test setups.
 */
export const TEST_TOKENS = {
  /** Token for admin user (all permissions) */
  admin: 'admin-token',
  /** Token for regular user (chat + knowledge:read) */
  user: 'valid-token',
  /** Token for user with no permissions */
  noPermissions: 'no-permissions-token',
  /** Simulates an expired JWT */
  expired: 'expired-token',
  /** Simulates an invalid/tampered JWT */
  invalid: 'invalid-token',
  /** Simulates a revoked JWT */
  revoked: 'revoked-token',
} as const;

/**
 * Creates an Authorization header value for supertest requests.
 *
 * @param token - One of the TEST_TOKENS values
 * @returns Bearer token string
 *
 * @example
 * ```ts
 * request(app.getHttpServer())
 *   .get('/api/v1/users/me')
 *   .set('Authorization', bearerToken(TEST_TOKENS.admin))
 *   .expect(200);
 * ```
 */
export function bearerToken(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Common authorization headers for supertest.
 *
 * @example
 * ```ts
 * request(app.getHttpServer())
 *   .get('/api/v1/users/me')
 *   .set(authHeaders.admin)
 *   .expect(200);
 * ```
 */
export const authHeaders = {
  admin: { Authorization: bearerToken(TEST_TOKENS.admin) },
  user: { Authorization: bearerToken(TEST_TOKENS.user) },
  noPermissions: { Authorization: bearerToken(TEST_TOKENS.noPermissions) },
  expired: { Authorization: bearerToken(TEST_TOKENS.expired) },
  invalid: { Authorization: bearerToken(TEST_TOKENS.invalid) },
  revoked: { Authorization: bearerToken(TEST_TOKENS.revoked) },
} as const;

