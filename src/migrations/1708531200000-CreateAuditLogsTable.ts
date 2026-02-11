import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Create Audit Logs Table Migration
 *
 * Creates the audit_logs table for storing security events.
 *
 * **Features**:
 * - Append-only table (no updates or deletes)
 * - Indexes for common queries (userId, createdAt, eventType)
 * - JSONB column for flexible metadata storage
 * - Composite indexes for performance
 *
 * Phase 6 Implementation:
 * - Issue 6.15: Audit Logging ✅
 */
export class CreateAuditLogsTable1708531200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45', // IPv6 max length
            isNullable: false,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for common queries
    // Index on userId for user audit trail queries
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_userId',
        columnNames: ['userId'],
      }),
    );

    // Index on createdAt for time-range queries and retention cleanup
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    // Composite index on userId + createdAt for user audit trail with time range
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    // Composite index on eventType + createdAt for event type filtering
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_eventType_createdAt',
        columnNames: ['eventType', 'createdAt'],
      }),
    );

    // Add comment to table
    await queryRunner.query(`
      COMMENT ON TABLE audit_logs IS 'Security audit log - append-only table for compliance';
    `);

    // Add comments to columns
    await queryRunner.query(`
      COMMENT ON COLUMN audit_logs."eventType" IS 'Type of security event (LOGIN, LOGOUT, ACCESS_DENIED, etc.)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN audit_logs."userId" IS 'User who triggered the event (null for unauthenticated events)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN audit_logs."metadata" IS 'Additional context-specific data in JSONB format';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'audit_logs',
      'IDX_audit_logs_eventType_createdAt',
    );
    await queryRunner.dropIndex(
      'audit_logs',
      'IDX_audit_logs_userId_createdAt',
    );
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_createdAt');
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_userId');

    // Drop table
    await queryRunner.dropTable('audit_logs');
  }
}
