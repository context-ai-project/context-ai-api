import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Table name constants
const ROLES_TABLE = 'roles';
const PERMISSIONS_TABLE = 'permissions';
const ROLE_PERMISSIONS_TABLE = 'role_permissions';
const USER_ROLES_TABLE = 'user_roles';
const USERS_TABLE = 'users';

// Column type constants
const UUID_TYPE = 'uuid';
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ_TYPE = 'timestamp with time zone';
const UUID_DEFAULT = 'uuid_generate_v4()';

/**
 * Create RBAC Tables Migration
 *
 * Creates the Role-Based Access Control tables:
 * - roles: System roles (admin, manager, user)
 * - permissions: Granular permissions (resource:action format)
 * - role_permissions: Many-to-many join table (roles ↔ permissions)
 * - user_roles: Many-to-many join table (users ↔ roles)
 *
 * Dependencies:
 * - Requires `users` table to exist (for user_roles FK)
 *
 * Phase 6 Implementation:
 * - Issue 6.8: Role & Permission Models ✅
 * - Issue 6.9: RBAC Guard ✅
 */
export class CreateRBACTables1708100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create roles table
    await queryRunner.createTable(
      new Table({
        name: ROLES_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: UUID_DEFAULT,
          },
          {
            name: 'name',
            type: VARCHAR_TYPE,
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_system_role',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ_TYPE,
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: TIMESTAMP_TZ_TYPE,
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create unique index on role name
    await queryRunner.createIndex(
      ROLES_TABLE,
      new TableIndex({
        name: 'IDX_roles_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // 2. Create permissions table
    await queryRunner.createTable(
      new Table({
        name: PERMISSIONS_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: UUID_DEFAULT,
          },
          {
            name: 'name',
            type: VARCHAR_TYPE,
            length: '100',
            isUnique: true,
            isNullable: false,
            comment:
              'Permission name in resource:action format (e.g., knowledge:create)',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resource',
            type: VARCHAR_TYPE,
            length: '50',
            isNullable: false,
            comment: 'Resource this permission applies to (e.g., knowledge)',
          },
          {
            name: 'action',
            type: VARCHAR_TYPE,
            length: '50',
            isNullable: false,
            comment: 'Action allowed on the resource (e.g., create, read)',
          },
          {
            name: 'is_system_permission',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ_TYPE,
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: TIMESTAMP_TZ_TYPE,
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes on permissions
    await queryRunner.createIndex(
      PERMISSIONS_TABLE,
      new TableIndex({
        name: 'IDX_permissions_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      PERMISSIONS_TABLE,
      new TableIndex({
        name: 'IDX_permissions_resource',
        columnNames: ['resource'],
      }),
    );

    await queryRunner.createIndex(
      PERMISSIONS_TABLE,
      new TableIndex({
        name: 'IDX_permissions_action',
        columnNames: ['action'],
      }),
    );

    // 3. Create role_permissions join table
    await queryRunner.createTable(
      new Table({
        name: ROLE_PERMISSIONS_TABLE,
        columns: [
          {
            name: 'role_id',
            type: UUID_TYPE,
            isNullable: false,
          },
          {
            name: 'permission_id',
            type: UUID_TYPE,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create composite primary key for role_permissions
    await queryRunner.query(`
      ALTER TABLE "${ROLE_PERMISSIONS_TABLE}"
      ADD CONSTRAINT "PK_role_permissions"
      PRIMARY KEY ("role_id", "permission_id")
    `);

    // Foreign keys for role_permissions
    await queryRunner.createForeignKey(
      ROLE_PERMISSIONS_TABLE,
      new TableForeignKey({
        name: 'FK_role_permissions_role',
        columnNames: ['role_id'],
        referencedTableName: ROLES_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      ROLE_PERMISSIONS_TABLE,
      new TableForeignKey({
        name: 'FK_role_permissions_permission',
        columnNames: ['permission_id'],
        referencedTableName: PERMISSIONS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // 4. Create user_roles join table
    await queryRunner.createTable(
      new Table({
        name: USER_ROLES_TABLE,
        columns: [
          {
            name: 'user_id',
            type: UUID_TYPE,
            isNullable: false,
          },
          {
            name: 'role_id',
            type: UUID_TYPE,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create composite primary key for user_roles
    await queryRunner.query(`
      ALTER TABLE "${USER_ROLES_TABLE}"
      ADD CONSTRAINT "PK_user_roles"
      PRIMARY KEY ("user_id", "role_id")
    `);

    // Foreign keys for user_roles
    await queryRunner.createForeignKey(
      USER_ROLES_TABLE,
      new TableForeignKey({
        name: 'FK_user_roles_user',
        columnNames: ['user_id'],
        referencedTableName: USERS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      USER_ROLES_TABLE,
      new TableForeignKey({
        name: 'FK_user_roles_role',
        columnNames: ['role_id'],
        referencedTableName: ROLES_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Add table comments
    await queryRunner.query(`
      COMMENT ON TABLE "${ROLES_TABLE}" IS 'RBAC roles (admin, manager, user)';
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "${PERMISSIONS_TABLE}" IS 'Granular permissions in resource:action format';
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "${ROLE_PERMISSIONS_TABLE}" IS 'Many-to-many: roles ↔ permissions';
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "${USER_ROLES_TABLE}" IS 'Many-to-many: users ↔ roles';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order to respect FK constraints

    // Drop user_roles
    await queryRunner.dropForeignKey(USER_ROLES_TABLE, 'FK_user_roles_role');
    await queryRunner.dropForeignKey(USER_ROLES_TABLE, 'FK_user_roles_user');
    await queryRunner.dropTable(USER_ROLES_TABLE);

    // Drop role_permissions
    await queryRunner.dropForeignKey(
      ROLE_PERMISSIONS_TABLE,
      'FK_role_permissions_permission',
    );
    await queryRunner.dropForeignKey(
      ROLE_PERMISSIONS_TABLE,
      'FK_role_permissions_role',
    );
    await queryRunner.dropTable(ROLE_PERMISSIONS_TABLE);

    // Drop permissions
    await queryRunner.dropIndex(PERMISSIONS_TABLE, 'IDX_permissions_action');
    await queryRunner.dropIndex(PERMISSIONS_TABLE, 'IDX_permissions_resource');
    await queryRunner.dropIndex(PERMISSIONS_TABLE, 'IDX_permissions_name');
    await queryRunner.dropTable(PERMISSIONS_TABLE);

    // Drop roles
    await queryRunner.dropIndex(ROLES_TABLE, 'IDX_roles_name');
    await queryRunner.dropTable(ROLES_TABLE);
  }
}
