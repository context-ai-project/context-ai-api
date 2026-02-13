import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuditLog,
  AuditEventType,
} from '../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../infrastructure/persistence/repositories/audit-log.repository';
import { extractErrorStack } from '@shared/utils';

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
 * await auditService.logEvent(AuditEventType.LOGIN, userId, { ip, userAgent });
 * await auditService.logEvent(AuditEventType.ACCESS_DENIED, userId, { ip, userAgent }, { resource: '/admin' });
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
   * Generic audit event logging method.
   * Use this for any audit event type — replaces the individual one-liner wrappers.
   *
   * @param eventType - The type of audit event
   * @param userId - The user ID (null for unauthenticated events like LOGIN_FAILED)
   * @param context - Request context (IP, user agent)
   * @param metadata - Optional additional metadata
   *
   * @example
   * ```typescript
   * await auditService.logEvent(AuditEventType.LOGIN, userId, { ip, userAgent });
   * await auditService.logEvent(AuditEventType.LOGIN_FAILED, null, { ip, userAgent }, { reason: 'bad password' });
   * ```
   */
  async logEvent(
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
    } catch (error: unknown) {
      // IMPORTANT: Never fail the main operation due to audit logging errors
      // Just log the error and continue
      this.logger.error(
        'Failed to save audit log',
        extractErrorStack(error) ?? String(error),
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
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      this.logger.warn('Invalid retentionDays; skipping cleanup', {
        retentionDays,
      });
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Math.floor(retentionDays));

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
