import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Constants to avoid string duplication
const USERS_TABLE = 'users';
const AUTH0_USER_ID_COLUMN = 'auth0_user_id';
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ_TYPE = 'timestamp with time zone';

export class CreateUsersTable1707434800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: USERS_TABLE,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: AUTH0_USER_ID_COLUMN,
            type: VARCHAR_TYPE,
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'email',
            type: VARCHAR_TYPE,
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
          {
            name: 'last_login_at',
            type: TIMESTAMP_TZ_TYPE,
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      USERS_TABLE,
      new TableIndex({
        name: 'IDX_users_auth0_user_id',
        columnNames: [AUTH0_USER_ID_COLUMN],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      USERS_TABLE,
      new TableIndex({
        name: 'IDX_users_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // Partial index for active users (PostgreSQL only)
    await queryRunner.query(`
      CREATE INDEX "IDX_users_is_active" ON "${USERS_TABLE}" ("is_active") WHERE "is_active" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_active";`);
    await queryRunner.dropIndex(USERS_TABLE, 'IDX_users_email');
    await queryRunner.dropIndex(USERS_TABLE, 'IDX_users_auth0_user_id');

    // Drop table
    await queryRunner.dropTable(USERS_TABLE);
  }
}
