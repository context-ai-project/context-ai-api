/**
 * User Test Fixtures
 *
 * Provides predefined user data for testing.
 * Each fixture includes all required fields for UserModel.
 *
 * Phase 7.10: Test Data Management
 */

import type { ValidatedUser } from '../../../src/modules/auth/types/jwt-payload.type';

// ============================================================================
// UUID Constants (deterministic for assertions)
// ============================================================================

export const TEST_USER_IDS = {
  admin: '11111111-1111-4111-a111-111111111111',
  manager: '22222222-2222-4222-a222-222222222222',
  regularUser: '33333333-3333-4333-a333-333333333333',
  viewer: '44444444-4444-4444-a444-444444444444',
  inactiveUser: '55555555-5555-4555-a555-555555555555',
} as const;

export const TEST_SECTOR_IDS = {
  tech: '550e8400-e29b-41d4-a716-446655440000',
  rrhh: '660e8400-e29b-41d4-a716-446655440001',
  finance: '770e8400-e29b-41d4-a716-446655440002',
  empty: '880e8400-e29b-41d4-a716-446655440003',
} as const;

// ============================================================================
// User Model Fixtures (for database seeding)
// ============================================================================

export interface UserFixture {
  id: string;
  auth0UserId: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export const ADMIN_USER_FIXTURE: UserFixture = {
  id: TEST_USER_IDS.admin,
  auth0UserId: 'auth0|admin-test-001',
  email: 'admin@contextai-test.com',
  name: 'Test Admin',
  isActive: true,
  lastLoginAt: new Date('2026-01-15T10:00:00Z'),
};

export const MANAGER_USER_FIXTURE: UserFixture = {
  id: TEST_USER_IDS.manager,
  auth0UserId: 'auth0|manager-test-002',
  email: 'manager@contextai-test.com',
  name: 'Test Manager',
  isActive: true,
  lastLoginAt: new Date('2026-01-20T14:30:00Z'),
};

export const REGULAR_USER_FIXTURE: UserFixture = {
  id: TEST_USER_IDS.regularUser,
  auth0UserId: 'auth0|user-test-003',
  email: 'user@contextai-test.com',
  name: 'Test User',
  isActive: true,
  lastLoginAt: new Date('2026-02-01T09:15:00Z'),
};

export const VIEWER_USER_FIXTURE: UserFixture = {
  id: TEST_USER_IDS.viewer,
  auth0UserId: 'auth0|viewer-test-004',
  email: 'viewer@contextai-test.com',
  name: 'Test Viewer',
  isActive: true,
  lastLoginAt: null,
};

export const INACTIVE_USER_FIXTURE: UserFixture = {
  id: TEST_USER_IDS.inactiveUser,
  auth0UserId: 'auth0|inactive-test-005',
  email: 'inactive@contextai-test.com',
  name: 'Inactive User',
  isActive: false,
  lastLoginAt: new Date('2025-06-01T00:00:00Z'),
};

export const ALL_USER_FIXTURES: UserFixture[] = [
  ADMIN_USER_FIXTURE,
  MANAGER_USER_FIXTURE,
  REGULAR_USER_FIXTURE,
  VIEWER_USER_FIXTURE,
  INACTIVE_USER_FIXTURE,
];

// ============================================================================
// ValidatedUser Fixtures (for JWT/auth testing)
// ============================================================================

export const VALIDATED_ADMIN: ValidatedUser = {
  userId: TEST_USER_IDS.admin,
  auth0Id: 'auth0|admin-test-001',
  email: 'admin@contextai-test.com',
  name: 'Test Admin',
  permissions: [
    'chat:read',
    'chat:write',
    'knowledge:read',
    'knowledge:create',
    'knowledge:delete',
    'users:manage',
    'profile:read',
    'profile:write',
    'audit:read',
  ],
  jti: 'test-jti-admin-001',
};

export const VALIDATED_MANAGER: ValidatedUser = {
  userId: TEST_USER_IDS.manager,
  auth0Id: 'auth0|manager-test-002',
  email: 'manager@contextai-test.com',
  name: 'Test Manager',
  permissions: [
    'chat:read',
    'chat:write',
    'knowledge:read',
    'knowledge:create',
    'profile:read',
    'profile:write',
  ],
  jti: 'test-jti-manager-002',
};

export const VALIDATED_USER: ValidatedUser = {
  userId: TEST_USER_IDS.regularUser,
  auth0Id: 'auth0|user-test-003',
  email: 'user@contextai-test.com',
  name: 'Test User',
  permissions: ['chat:read', 'chat:write', 'knowledge:read', 'profile:read'],
  jti: 'test-jti-user-003',
};

export const VALIDATED_VIEWER: ValidatedUser = {
  userId: TEST_USER_IDS.viewer,
  auth0Id: 'auth0|viewer-test-004',
  email: 'viewer@contextai-test.com',
  name: 'Test Viewer',
  permissions: ['knowledge:read', 'profile:read'],
  jti: 'test-jti-viewer-004',
};

export const VALIDATED_NO_PERMS: ValidatedUser = {
  userId: '99999999-9999-4999-a999-999999999999',
  auth0Id: 'auth0|noperms-test-099',
  email: 'noperms@contextai-test.com',
  name: 'No Permissions User',
  permissions: [],
  jti: 'test-jti-noperms-099',
};

