import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Table name constants
const INVITATIONS_TABLE = 'invitations';
const INVITATION_SECTORS_TABLE = 'invitation_sectors';
const NOTIFICATIONS_TABLE = 'notifications';
const USERS_TABLE = 'users';
const SECTORS_TABLE = 'sectors';

// Column type constants
const UUID_TYPE = 'uuid';
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';

/**
 * Create Invitations and Notifications Tables Migration
 *
 * Creates three tables for v1.3:
 * - invitations: Tracks user invitations from admin
 * - invitation_sectors: Many-to-Many join between invitations and sectors
 * - notifications: In-app notification system
 *
 * Dependencies:
 * - Requires `users` table to exist
 * - Requires `sectors` table to exist
 */
export class CreateInvitationsAndNotificationsTables1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== 1. INVITATIONS TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: INVITATIONS_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: false,
          },
          {
            name: 'name',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: false,
          },
          {
            name: 'role',
            type: VARCHAR_TYPE,
            length: '50',
            default: "'user'",
            isNullable: false,
          },
          {
            name: 'status',
            type: VARCHAR_TYPE,
            length: '20',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'token',
            type: VARCHAR_TYPE,
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          { name: 'invited_by', type: UUID_TYPE, isNullable: false },
          {
            name: 'auth0_user_id',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: true,
          },
          { name: 'expires_at', type: TIMESTAMP_TZ, isNullable: false },
          { name: 'accepted_at', type: TIMESTAMP_TZ, isNullable: true },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign key: invited_by → users.id
    await queryRunner.createForeignKey(
      INVITATIONS_TABLE,
      new TableForeignKey({
        name: 'FK_invitations_invited_by',
        columnNames: ['invited_by'],
        referencedTableName: USERS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    // Indexes for invitations
    await queryRunner.createIndex(
      INVITATIONS_TABLE,
      new TableIndex({ name: 'idx_invitations_email', columnNames: ['email'] }),
    );
    await queryRunner.createIndex(
      INVITATIONS_TABLE,
      new TableIndex({
        name: 'idx_invitations_status',
        columnNames: ['status'],
      }),
    );

    // ==================== 2. INVITATION_SECTORS TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: INVITATION_SECTORS_TABLE,
        columns: [
          { name: 'invitation_id', type: UUID_TYPE, isNullable: false },
          { name: 'sector_id', type: UUID_TYPE, isNullable: false },
        ],
      }),
      true,
    );

    // Composite primary key
    await queryRunner.query(`
      ALTER TABLE "${INVITATION_SECTORS_TABLE}"
      ADD CONSTRAINT "PK_invitation_sectors"
      PRIMARY KEY ("invitation_id", "sector_id")
    `);

    // Foreign keys
    await queryRunner.createForeignKey(
      INVITATION_SECTORS_TABLE,
      new TableForeignKey({
        name: 'FK_invitation_sectors_invitation',
        columnNames: ['invitation_id'],
        referencedTableName: INVITATIONS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      INVITATION_SECTORS_TABLE,
      new TableForeignKey({
        name: 'FK_invitation_sectors_sector',
        columnNames: ['sector_id'],
        referencedTableName: SECTORS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Index for sector lookups
    await queryRunner.createIndex(
      INVITATION_SECTORS_TABLE,
      new TableIndex({
        name: 'idx_invitation_sectors_sector',
        columnNames: ['sector_id'],
      }),
    );

    // ==================== 3. NOTIFICATIONS TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: NOTIFICATIONS_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'user_id', type: UUID_TYPE, isNullable: false },
          { name: 'type', type: VARCHAR_TYPE, length: '50', isNullable: false },
          {
            name: 'title',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: false,
          },
          { name: 'message', type: 'text', isNullable: false },
          {
            name: 'is_read',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign key: user_id → users.id
    await queryRunner.createForeignKey(
      NOTIFICATIONS_TABLE,
      new TableForeignKey({
        name: 'FK_notifications_user',
        columnNames: ['user_id'],
        referencedTableName: USERS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Indexes for notifications
    await queryRunner.createIndex(
      NOTIFICATIONS_TABLE,
      new TableIndex({
        name: 'idx_notifications_user_read',
        columnNames: ['user_id', 'is_read'],
      }),
    );
    await queryRunner.createIndex(
      NOTIFICATIONS_TABLE,
      new TableIndex({
        name: 'idx_notifications_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    // Table comments
    await queryRunner.query(`
      COMMENT ON TABLE "${INVITATIONS_TABLE}"
      IS 'User invitations — admin invites users to create accounts';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE "${INVITATION_SECTORS_TABLE}"
      IS 'Many-to-many: invitations ↔ sectors — sectors assigned to invited users';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE "${NOTIFICATIONS_TABLE}"
      IS 'In-app notifications — event-driven notification system';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order due to foreign key constraints
    await queryRunner.dropForeignKey(
      NOTIFICATIONS_TABLE,
      'FK_notifications_user',
    );
    await queryRunner.dropTable(NOTIFICATIONS_TABLE);

    await queryRunner.dropForeignKey(
      INVITATION_SECTORS_TABLE,
      'FK_invitation_sectors_sector',
    );
    await queryRunner.dropForeignKey(
      INVITATION_SECTORS_TABLE,
      'FK_invitation_sectors_invitation',
    );
    await queryRunner.dropTable(INVITATION_SECTORS_TABLE);

    await queryRunner.dropForeignKey(
      INVITATIONS_TABLE,
      'FK_invitations_invited_by',
    );
    await queryRunner.dropTable(INVITATIONS_TABLE);
  }
}
