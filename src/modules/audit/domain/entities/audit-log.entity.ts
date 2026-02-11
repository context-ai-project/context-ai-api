/**
 * Audit Event Types
 *
 * Defines the types of security events that are logged in the system.
 * These events are critical for:
 * - Security compliance (GDPR, SOC 2, ISO 27001)
 * - Debugging and troubleshooting
 * - Incident response
 * - User behavior analysis
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
export enum AuditEventType {
  /**
   * User successfully authenticated with the system
   */
  LOGIN = 'LOGIN',

  /**
   * User logged out from the system
   */
  LOGOUT = 'LOGOUT',

  /**
   * Failed authentication attempt (invalid token, expired, etc.)
   */
  LOGIN_FAILED = 'LOGIN_FAILED',

  /**
   * User role was changed by an administrator
   */
  ROLE_CHANGED = 'ROLE_CHANGED',

  /**
   * User permission was changed by an administrator
   */
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',

  /**
   * Access was denied due to insufficient permissions (403)
   */
  ACCESS_DENIED = 'ACCESS_DENIED',

  /**
   * Token was revoked (immediate logout)
   */
  TOKEN_REVOKED = 'TOKEN_REVOKED',

  /**
   * Rate limit was exceeded
   */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  /**
   * Sensitive data was accessed
   */
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',

  /**
   * Data was exported
   */
  DATA_EXPORT = 'DATA_EXPORT',

  /**
   * User account was created
   */
  USER_CREATED = 'USER_CREATED',

  /**
   * User account was deleted
   */
  USER_DELETED = 'USER_DELETED',

  /**
   * User account was suspended
   */
  USER_SUSPENDED = 'USER_SUSPENDED',
}

/**
 * Audit Log Entity (Domain Model)
 *
 * Represents a security audit event in the system.
 * This is the domain representation - business logic layer.
 *
 * **Fields**:
 * - `id`: Unique identifier (UUID)
 * - `eventType`: Type of security event
 * - `userId`: User who triggered the event (optional)
 * - `ipAddress`: IP address of the request
 * - `userAgent`: User agent string from the request
 * - `metadata`: Additional context-specific data (JSON)
 * - `createdAt`: When the event occurred
 *
 * **IMPORTANT**: This entity is append-only. Never update or delete audit logs.
 */
export class AuditLog {
  /**
   * Unique identifier for the audit log entry
   */
  id: string;

  /**
   * Type of security event that occurred
   */
  eventType: AuditEventType;

  /**
   * ID of the user who triggered this event (if applicable)
   * Null for unauthenticated events (e.g., failed login)
   */
  userId: string | null;

  /**
   * IP address from which the request originated
   */
  ipAddress: string;

  /**
   * User agent string from the HTTP request
   */
  userAgent: string;

  /**
   * Additional metadata specific to the event type
   *
   * Examples:
   * - LOGIN_FAILED: { error: 'Invalid token', reason: 'TokenExpiredError' }
   * - ROLE_CHANGED: { oldRole: 'user', newRole: 'manager', changedBy: 'admin-uuid' }
   * - ACCESS_DENIED: { resource: '/admin/users', requiredPermission: 'users:manage' }
   */
  metadata: Record<string, unknown> | null;

  /**
   * Timestamp when the event occurred
   */
  createdAt: Date;

  /**
   * Private constructor to enforce factory method usage
   */
  private constructor(
    id: string,
    eventType: AuditEventType,
    userId: string | null,
    ipAddress: string,
    userAgent: string,
    metadata: Record<string, unknown> | null,
    createdAt: Date,
  ) {
    this.id = id;
    this.eventType = eventType;
    this.userId = userId;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.metadata = metadata;
    this.createdAt = createdAt;
  }

  /**
   * Factory method to create a new audit log entry
   *
   * @param params - Audit log parameters
   * @returns New AuditLog entity instance
   */
  static create(params: {
    id: string;
    eventType: AuditEventType;
    userId?: string | null;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown> | null;
    createdAt?: Date;
  }): AuditLog {
    return new AuditLog(
      params.id,
      params.eventType,
      params.userId ?? null,
      params.ipAddress,
      params.userAgent,
      params.metadata ?? null,
      params.createdAt ?? new Date(),
    );
  }

  /**
   * Reconstitute an audit log from persistence
   * Used by the repository to convert database rows to domain entities
   *
   * @param params - Persisted audit log data
   * @returns AuditLog entity instance
   */
  static reconstitute(params: {
    id: string;
    eventType: AuditEventType;
    userId: string | null;
    ipAddress: string;
    userAgent: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }): AuditLog {
    return new AuditLog(
      params.id,
      params.eventType,
      params.userId,
      params.ipAddress,
      params.userAgent,
      params.metadata,
      params.createdAt,
    );
  }

  /**
   * Check if this audit log is related to authentication
   */
  isAuthenticationEvent(): boolean {
    return [
      AuditEventType.LOGIN,
      AuditEventType.LOGOUT,
      AuditEventType.LOGIN_FAILED,
    ].includes(this.eventType);
  }

  /**
   * Check if this audit log is related to authorization
   */
  isAuthorizationEvent(): boolean {
    return [
      AuditEventType.ACCESS_DENIED,
      AuditEventType.ROLE_CHANGED,
      AuditEventType.PERMISSION_CHANGED,
    ].includes(this.eventType);
  }

  /**
   * Check if this audit log is a security threat indicator
   */
  isSecurityThreat(): boolean {
    return [
      AuditEventType.LOGIN_FAILED,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.RATE_LIMIT_EXCEEDED,
    ].includes(this.eventType);
  }

  /**
   * Mask sensitive data in the audit log for display
   * (keeps full data in DB for compliance, but masks for UI)
   */
  maskSensitiveData(): Pick<
    AuditLog,
    'id' | 'eventType' | 'userId' | 'metadata' | 'createdAt'
  > & {
    ipAddress: string;
    userAgent: string;
  } {
    return {
      ...this,
      ipAddress: this.maskIpAddress(this.ipAddress),
      userAgent: this.maskUserAgent(this.userAgent),
    };
  }

  /**
   * Mask IP address for privacy (GDPR compliance)
   * Example: 192.168.1.100 → 192.168.*.***
   */
  private maskIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`;
    }
    // IPv6 or invalid format
    return ip.substring(0, 10) + '...';
  }

  /**
   * Mask user agent to show only browser/OS
   * Example: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..." → "Chrome on macOS"
   */
  private maskUserAgent(ua: string): string {
    if (ua.includes('Chrome')) {
      return 'Chrome';
    }
    if (ua.includes('Safari')) {
      return 'Safari';
    }
    if (ua.includes('Firefox')) {
      return 'Firefox';
    }
    if (ua.includes('Edge')) {
      return 'Edge';
    }
    return 'Unknown Browser';
  }
}
