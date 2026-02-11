import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditEventType } from '../../../domain/entities/audit-log.entity';

/**
 * Audit Log Model (Persistence Layer)
 *
 * TypeORM model for storing audit logs in PostgreSQL.
 * This is an append-only table - never update or delete records.
 *
 * **Indexes**:
 * - `userId`: For querying logs by user
 * - `createdAt`: For time-range queries and retention cleanup
 * - `eventType`: For filtering by event type
 *
 * **Retention Policy**:
 * - Keep audit logs for 1 year minimum (compliance)
 * - Archive after 1 year (move to cold storage)
 * - Never delete critical events (LOGIN_FAILED, ACCESS_DENIED)
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
@Entity('audit_logs')
@Index(['userId', 'createdAt']) // Composite index for user audit trail
@Index(['eventType', 'createdAt']) // For event type filtering with time range
@Index(['createdAt']) // For retention cleanup queries
export class AuditLogModel {
  /**
   * Primary key - UUID
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Type of security event
   * Stored as enum string in PostgreSQL
   */
  @Column({
    type: 'varchar',
    length: 50,
  })
  eventType!: AuditEventType;

  /**
   * User ID who triggered the event
   * Null for unauthenticated events
   */
  @Column({
    type: 'uuid',
    nullable: true,
  })
  @Index() // Frequently queried for user audit trails
  userId!: string | null;

  /**
   * IP address of the request
   * Stored as string (supports IPv4 and IPv6)
   */
  @Column({
    type: 'varchar',
    length: 45, // IPv6 max length: 45 chars
  })
  ipAddress!: string;

  /**
   * User agent string from HTTP headers
   */
  @Column({
    type: 'varchar',
    length: 500,
  })
  userAgent!: string;

  /**
   * Additional context-specific metadata
   * Stored as JSONB for efficient querying
   */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  /**
   * Timestamp when the event occurred
   * Automatically set by TypeORM
   */
  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  @Index() // For time-range queries
  createdAt!: Date;
}
