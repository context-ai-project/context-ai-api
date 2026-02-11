import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuditLog,
  AuditEventType,
} from '../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../infrastructure/persistence/repositories/audit-log.repository';

/**
 * Request context for audit logging
 */
interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Audit Service
 *
 * Application service for logging security events and compliance tracking.
 *
 * **Features**:
 * - Async logging (non-blocking)
 * - Structured logging
 * - Privacy-conscious (masks sensitive data)
 * - Error handling (never fails the main operation)
 *
 * **Usage**:
 * ```typescript
 * // In a controller or guard
 * await auditService.logLogin(userId, request);
 * await auditService.logAccessDenied(userId, request, { resource: '/admin' });
 * ```
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Log a successful login event
   */
  async logLogin(
    userId: string,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(AuditEventType.LOGIN, userId, context, metadata);
  }

  /**
   * Log a logout event
   */
  async logLogout(
    userId: string,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(AuditEventType.LOGOUT, userId, context, metadata);
  }

  /**
   * Log a failed login attempt
   */
  async logLoginFailed(
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(
      AuditEventType.LOGIN_FAILED,
      null, // No userId for failed login
      context,
      metadata,
    );
  }

  /**
   * Log an access denied event (403)
   */
  async logAccessDenied(
    userId: string | null,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(AuditEventType.ACCESS_DENIED, userId, context, metadata);
  }

  /**
   * Log a role change event
   */
  async logRoleChanged(
    userId: string,
    context: RequestContext,
    metadata: {
      oldRole: string;
      newRole: string;
      changedBy: string;
    },
  ): Promise<void> {
    await this.log(AuditEventType.ROLE_CHANGED, userId, context, metadata);
  }

  /**
   * Log a permission change event
   */
  async logPermissionChanged(
    userId: string,
    context: RequestContext,
    metadata: {
      permission: string;
      action: 'granted' | 'revoked';
      changedBy: string;
    },
  ): Promise<void> {
    await this.log(
      AuditEventType.PERMISSION_CHANGED,
      userId,
      context,
      metadata,
    );
  }

  /**
   * Log a token revocation event
   */
  async logTokenRevoked(
    userId: string,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(AuditEventType.TOKEN_REVOKED, userId, context, metadata);
  }

  /**
   * Log a rate limit exceeded event
   */
  async logRateLimitExceeded(
    userId: string | null,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(
      AuditEventType.RATE_LIMIT_EXCEEDED,
      userId,
      context,
      metadata,
    );
  }

  /**
   * Log a sensitive data access event
   */
  async logSensitiveDataAccess(
    userId: string,
    context: RequestContext,
    metadata: {
      resource: string;
      action: string;
    },
  ): Promise<void> {
    await this.log(
      AuditEventType.SENSITIVE_DATA_ACCESS,
      userId,
      context,
      metadata,
    );
  }

  /**
   * Log a data export event
   */
  async logDataExport(
    userId: string,
    context: RequestContext,
    metadata: {
      format: string;
      recordCount: number;
    },
  ): Promise<void> {
    await this.log(AuditEventType.DATA_EXPORT, userId, context, metadata);
  }

  /**
   * Log a user creation event
   */
  async logUserCreated(
    userId: string,
    context: RequestContext,
    metadata: {
      createdBy: string;
      role: string;
    },
  ): Promise<void> {
    await this.log(AuditEventType.USER_CREATED, userId, context, metadata);
  }

  /**
   * Log a user deletion event
   */
  async logUserDeleted(
    userId: string,
    context: RequestContext,
    metadata: {
      deletedBy: string;
    },
  ): Promise<void> {
    await this.log(AuditEventType.USER_DELETED, userId, context, metadata);
  }

  /**
   * Log a user suspension event
   */
  async logUserSuspended(
    userId: string,
    context: RequestContext,
    metadata: {
      suspendedBy: string;
      reason: string;
    },
  ): Promise<void> {
    await this.log(AuditEventType.USER_SUSPENDED, userId, context, metadata);
  }

  /**
   * Generic log method (internal use)
   */
  private async log(
    eventType: AuditEventType,
    userId: string | null,
    context: RequestContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const auditLog = AuditLog.create({
        id: randomUUID(),
        eventType,
        userId,
        ipAddress: context.ip ?? 'unknown',
        userAgent: context.userAgent ?? 'unknown',
        metadata,
      });

      // Async save (non-blocking)
      await this.auditLogRepository.save(auditLog);

      // Log to console for immediate visibility (structured logging)
      this.logger.log('Audit event logged', {
        eventType,
        userId: userId ? `${userId.substring(0, 8)}...` : null,
        ip: this.maskIp(context.ip ?? 'unknown'),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // IMPORTANT: Never fail the main operation due to audit logging errors
      // Just log the error and continue
      this.logger.error(
        'Failed to save audit log',
        error instanceof Error ? error.stack : String(error),
        {
          eventType,
          userId,
        },
      );
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.findByUserId(userId, options);
  }

  /**
   * Get audit logs by event type
   */
  async getAuditLogsByEventType(
    eventType: AuditEventType,
    options?: { limit?: number; startDate?: Date; endDate?: Date },
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.findByEventType(eventType, options);
  }

  /**
   * Get recent security threats
   */
  async getSecurityThreats(options?: {
    limit?: number;
    since?: Date;
  }): Promise<AuditLog[]> {
    return this.auditLogRepository.findSecurityThreats(options);
  }

  /**
   * Get audit log count for a user
   */
  async getUserAuditLogCount(userId: string): Promise<number> {
    return this.auditLogRepository.countByUserId(userId);
  }

  /**
   * Cleanup old audit logs (for retention compliance)
   * Should be called periodically by a cron job
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedCount =
      await this.auditLogRepository.deleteOlderThan(cutoffDate);

    this.logger.log('Cleaned up old audit logs', {
      cutoffDate: cutoffDate.toISOString(),
      deletedCount,
      retentionDays,
    });

    return deletedCount;
  }

  /**
   * Mask IP address for privacy (used in console logs)
   */
  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`;
    }
    return ip.substring(0, 10) + '...';
  }
}
