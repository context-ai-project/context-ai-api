import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { AuditLogModel } from '../models/audit-log.model';
import {
  AuditLog,
  AuditEventType,
} from '../../../domain/entities/audit-log.entity';

/**
 * Audit Log Repository
 *
 * Handles persistence operations for audit logs.
 * This is an append-only repository - no update or delete operations.
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogModel)
    private readonly repository: Repository<AuditLogModel>,
  ) {}

  /**
   * Save a new audit log entry
   * @param auditLog - Audit log domain entity
   */
  async save(auditLog: AuditLog): Promise<void> {
    const model = this.toModel(auditLog);
    await this.repository.save(model);
  }

  /**
   * Find audit logs by user ID
   */
  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLog[]> {
    const models = await this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });

    return models.map((model) => this.toDomain(model));
  }

  /**
   * Find audit logs by event type
   */
  async findByEventType(
    eventType: AuditEventType,
    options?: { limit?: number; startDate?: Date; endDate?: Date },
  ): Promise<AuditLog[]> {
    const query = this.repository
      .createQueryBuilder('audit_log')
      .where('audit_log.eventType = :eventType', { eventType });

    if (options?.startDate) {
      query.andWhere('audit_log.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options?.endDate) {
      query.andWhere('audit_log.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    query.orderBy('audit_log.createdAt', 'DESC');

    if (options?.limit) {
      query.take(options.limit);
    }

    const models = await query.getMany();
    return models.map((model) => this.toDomain(model));
  }

  /**
   * Find recent security threat events
   */
  async findSecurityThreats(options?: {
    limit?: number;
    since?: Date;
  }): Promise<AuditLog[]> {
    const threatTypes: AuditEventType[] = [
      AuditEventType.LOGIN_FAILED,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.RATE_LIMIT_EXCEEDED,
    ];

    const query = this.repository
      .createQueryBuilder('audit_log')
      .where('audit_log.eventType IN (:...threatTypes)', { threatTypes });

    if (options?.since) {
      query.andWhere('audit_log.createdAt >= :since', { since: options.since });
    }

    query.orderBy('audit_log.createdAt', 'DESC');
    query.take(options?.limit ?? 50);

    const models = await query.getMany();
    return models.map((model) => this.toDomain(model));
  }

  /**
   * Count audit logs by user
   */
  async countByUserId(userId: string): Promise<number> {
    return this.repository.count({ where: { userId } });
  }

  /**
   * Delete old audit logs (for retention compliance)
   * @param beforeDate - Delete logs older than this date
   * @returns Number of deleted records
   */
  async deleteOlderThan(beforeDate: Date): Promise<number> {
    const result = await this.repository.delete({
      createdAt: LessThanOrEqual(beforeDate),
    });

    return result.affected ?? 0;
  }

  /**
   * Convert domain entity to persistence model
   */
  private toModel(auditLog: AuditLog): AuditLogModel {
    const model = new AuditLogModel();
    model.id = auditLog.id;
    model.eventType = auditLog.eventType;
    model.userId = auditLog.userId;
    model.ipAddress = auditLog.ipAddress;
    model.userAgent = auditLog.userAgent;
    model.metadata = auditLog.metadata;
    model.createdAt = auditLog.createdAt;
    return model;
  }

  /**
   * Convert persistence model to domain entity
   */
  private toDomain(model: AuditLogModel): AuditLog {
    return AuditLog.reconstitute({
      id: model.id,
      eventType: model.eventType,
      userId: model.userId,
      ipAddress: model.ipAddress,
      userAgent: model.userAgent,
      metadata: model.metadata,
      createdAt: model.createdAt,
    });
  }
}
