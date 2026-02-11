import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Table name constant
const AUDIT_LOGS_TABLE = 'audit_logs';

// Column type constants
const UUID_TYPE = 'uuid';
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ_TYPE = 'timestamp with time zone';
const UUID_DEFAULT = 'uuid_generate_v4()';

/**
 * Create Audit Logs Table Migration
 *
 * Creates the audit_logs table for storing security events.
 *
 * **Features**:
 * - Append-only table (no updates or deletes)
 * - Indexes for common queries (user_id, created_at, event_type)
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
        name: AUDIT_LOGS_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: UUID_DEFAULT,
          },
          {
            name: 'event_type',
            type: VARCHAR_TYPE,
            length: '50',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: UUID_TYPE,
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: VARCHAR_TYPE,
            length: '45', // IPv6 max length
            isNullable: false,
          },
          {
            name: 'user_agent',
            type: VARCHAR_TYPE,
            length: '500',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ_TYPE,
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for common queries
    // Index on user_id for user audit trail queries
    await queryRunner.createIndex(
      AUDIT_LOGS_TABLE,
      new TableIndex({
        name: 'IDX_audit_logs_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Index on created_at for time-range queries and retention cleanup
    await queryRunner.createIndex(
      AUDIT_LOGS_TABLE,
      new TableIndex({
        name: 'IDX_audit_logs_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Composite index on user_id + created_at for user audit trail with time range
    await queryRunner.createIndex(
      AUDIT_LOGS_TABLE,
      new TableIndex({
        name: 'IDX_audit_logs_user_id_created_at',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    // Composite index on event_type + created_at for event type filtering
    await queryRunner.createIndex(
      AUDIT_LOGS_TABLE,
      new TableIndex({
        name: 'IDX_audit_logs_event_type_created_at',
        columnNames: ['event_type', 'created_at'],
      }),
    );

    // Add comment to table
    await queryRunner.query(`
      COMMENT ON TABLE "${AUDIT_LOGS_TABLE}" IS 'Security audit log - append-only table for compliance';
    `);

    // Add comments to columns
    await queryRunner.query(`
      COMMENT ON COLUMN "${AUDIT_LOGS_TABLE}"."event_type" IS 'Type of security event (LOGIN, LOGOUT, ACCESS_DENIED, etc.)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "${AUDIT_LOGS_TABLE}"."user_id" IS 'User who triggered the event (null for unauthenticated events)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "${AUDIT_LOGS_TABLE}"."metadata" IS 'Additional context-specific data in JSONB format';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      AUDIT_LOGS_TABLE,
      'IDX_audit_logs_event_type_created_at',
    );
    await queryRunner.dropIndex(
      AUDIT_LOGS_TABLE,
      'IDX_audit_logs_user_id_created_at',
    );
    await queryRunner.dropIndex(AUDIT_LOGS_TABLE, 'IDX_audit_logs_created_at');
    await queryRunner.dropIndex(AUDIT_LOGS_TABLE, 'IDX_audit_logs_user_id');

    // Drop table
    await queryRunner.dropTable(AUDIT_LOGS_TABLE);
  }
}
