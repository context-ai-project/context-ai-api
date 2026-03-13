import {
  AuditLog,
  AuditEventType,
} from '../../../../../../src/modules/audit/domain/entities/audit-log.entity';

const AUDIT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const CREATED_AT = new Date('2026-01-01T00:00:00Z');

function createLog(
  overrides?: Partial<Parameters<typeof AuditLog.create>[0]>,
) {
  return AuditLog.create({
    id: AUDIT_ID,
    eventType: AuditEventType.LOGIN,
    userId: USER_ID,
    ipAddress: '192.168.1.100',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
    metadata: { source: 'web' },
    createdAt: CREATED_AT,
    ...overrides,
  });
}

describe('AuditLog', () => {
  describe('create', () => {
    it('should create an audit log with all fields', () => {
      const log = createLog();

      expect(log.id).toBe(AUDIT_ID);
      expect(log.eventType).toBe(AuditEventType.LOGIN);
      expect(log.userId).toBe(USER_ID);
      expect(log.ipAddress).toBe('192.168.1.100');
      expect(log.metadata).toEqual({ source: 'web' });
      expect(log.createdAt).toBe(CREATED_AT);
    });

    it('should default userId to null when not provided', () => {
      const log = AuditLog.create({
        id: AUDIT_ID,
        eventType: AuditEventType.LOGIN_FAILED,
        ipAddress: '10.0.0.1',
        userAgent: 'curl',
      });

      expect(log.userId).toBeNull();
    });

    it('should default metadata to null when not provided', () => {
      const log = AuditLog.create({
        id: AUDIT_ID,
        eventType: AuditEventType.LOGIN,
        userId: USER_ID,
        ipAddress: '10.0.0.1',
        userAgent: 'curl',
      });

      expect(log.metadata).toBeNull();
    });

    it('should default createdAt to now when not provided', () => {
      const before = new Date();
      const log = AuditLog.create({
        id: AUDIT_ID,
        eventType: AuditEventType.LOGIN,
        ipAddress: '10.0.0.1',
        userAgent: 'curl',
      });
      const after = new Date();

      expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(log.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence data', () => {
      const log = AuditLog.reconstitute({
        id: AUDIT_ID,
        eventType: AuditEventType.ROLE_CHANGED,
        userId: USER_ID,
        ipAddress: '10.0.0.1',
        userAgent: 'Safari/17.0',
        metadata: { oldRole: 'user', newRole: 'admin' },
        createdAt: CREATED_AT,
      });

      expect(log.id).toBe(AUDIT_ID);
      expect(log.eventType).toBe(AuditEventType.ROLE_CHANGED);
      expect(log.metadata).toEqual({ oldRole: 'user', newRole: 'admin' });
    });
  });

  describe('isAuthenticationEvent', () => {
    it('should return true for LOGIN', () => {
      expect(createLog({ eventType: AuditEventType.LOGIN }).isAuthenticationEvent()).toBe(true);
    });

    it('should return true for LOGOUT', () => {
      expect(createLog({ eventType: AuditEventType.LOGOUT }).isAuthenticationEvent()).toBe(true);
    });

    it('should return true for LOGIN_FAILED', () => {
      expect(createLog({ eventType: AuditEventType.LOGIN_FAILED }).isAuthenticationEvent()).toBe(true);
    });

    it('should return false for non-auth events', () => {
      expect(createLog({ eventType: AuditEventType.ACCESS_DENIED }).isAuthenticationEvent()).toBe(false);
    });
  });

  describe('isAuthorizationEvent', () => {
    it('should return true for ACCESS_DENIED', () => {
      expect(createLog({ eventType: AuditEventType.ACCESS_DENIED }).isAuthorizationEvent()).toBe(true);
    });

    it('should return true for ROLE_CHANGED', () => {
      expect(createLog({ eventType: AuditEventType.ROLE_CHANGED }).isAuthorizationEvent()).toBe(true);
    });

    it('should return true for PERMISSION_CHANGED', () => {
      expect(createLog({ eventType: AuditEventType.PERMISSION_CHANGED }).isAuthorizationEvent()).toBe(true);
    });

    it('should return false for non-authorization events', () => {
      expect(createLog({ eventType: AuditEventType.LOGIN }).isAuthorizationEvent()).toBe(false);
    });
  });

  describe('isSecurityThreat', () => {
    it('should return true for LOGIN_FAILED', () => {
      expect(createLog({ eventType: AuditEventType.LOGIN_FAILED }).isSecurityThreat()).toBe(true);
    });

    it('should return true for ACCESS_DENIED', () => {
      expect(createLog({ eventType: AuditEventType.ACCESS_DENIED }).isSecurityThreat()).toBe(true);
    });

    it('should return true for RATE_LIMIT_EXCEEDED', () => {
      expect(createLog({ eventType: AuditEventType.RATE_LIMIT_EXCEEDED }).isSecurityThreat()).toBe(true);
    });

    it('should return false for non-threat events', () => {
      expect(createLog({ eventType: AuditEventType.LOGIN }).isSecurityThreat()).toBe(false);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask IPv4 address', () => {
      const log = createLog({ ipAddress: '192.168.1.100' });
      const masked = log.maskSensitiveData();

      expect(masked.ipAddress).toBe('192.168.*.***');
    });

    it('should mask short non-IPv4 addresses by substring', () => {
      const log = createLog({ ipAddress: '::1' });
      const masked = log.maskSensitiveData();

      // substring(0,10) of '::1' returns '::1', then '...' appended
      expect(masked.ipAddress).toBe('::1...');
    });

    it('should mask long non-IPv4 addresses', () => {
      const log = createLog({
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });
      const masked = log.maskSensitiveData();

      expect(masked.ipAddress).toBe('2001:0db8:...');
    });

    it('should detect Chrome user agent', () => {
      const log = createLog({ userAgent: 'Mozilla/5.0 Chrome/120.0.0.0' });
      const masked = log.maskSensitiveData();

      expect(masked.userAgent).toBe('Chrome');
    });

    it('should detect Safari user agent', () => {
      const log = createLog({ userAgent: 'Mozilla/5.0 Safari/17.0' });
      const masked = log.maskSensitiveData();

      expect(masked.userAgent).toBe('Safari');
    });

    it('should detect Firefox user agent', () => {
      const log = createLog({ userAgent: 'Mozilla/5.0 Firefox/121.0' });
      const masked = log.maskSensitiveData();

      expect(masked.userAgent).toBe('Firefox');
    });

    it('should detect Edge user agent', () => {
      const log = createLog({ userAgent: 'Mozilla/5.0 Edge/120.0.0.0' });
      const masked = log.maskSensitiveData();

      expect(masked.userAgent).toBe('Edge');
    });

    it('should return Unknown Browser for unrecognized agents', () => {
      const log = createLog({ userAgent: 'curl/7.68.0' });
      const masked = log.maskSensitiveData();

      expect(masked.userAgent).toBe('Unknown Browser');
    });

    it('should preserve non-sensitive fields', () => {
      const log = createLog();
      const masked = log.maskSensitiveData();

      expect(masked.id).toBe(AUDIT_ID);
      expect(masked.eventType).toBe(AuditEventType.LOGIN);
      expect(masked.userId).toBe(USER_ID);
      expect(masked.metadata).toEqual({ source: 'web' });
    });
  });
});
