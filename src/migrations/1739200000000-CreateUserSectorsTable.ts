import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Table name constants
const USER_SECTORS_TABLE = 'user_sectors';
const USERS_TABLE = 'users';
const SECTORS_TABLE = 'sectors';

// Column type constant
const UUID_TYPE = 'uuid';

/**
 * Create User-Sectors Join Table Migration
 *
 * Creates the many-to-many join table between users and sectors.
 * This allows assigning one or multiple sectors to each user,
 * controlling which knowledge bases they can access.
 *
 * Dependencies:
 * - Requires `users` table to exist
 * - Requires `sectors` table to exist
 */
export class CreateUserSectorsTable1739200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create user_sectors join table
    await queryRunner.createTable(
      new Table({
        name: USER_SECTORS_TABLE,
        columns: [
          {
            name: 'user_id',
            type: UUID_TYPE,
            isNullable: false,
          },
          {
            name: 'sector_id',
            type: UUID_TYPE,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 2. Create composite primary key
    await queryRunner.query(`
      ALTER TABLE "${USER_SECTORS_TABLE}"
      ADD CONSTRAINT "PK_user_sectors"
      PRIMARY KEY ("user_id", "sector_id")
    `);

    // 3. Foreign key: user_id → users.id
    await queryRunner.createForeignKey(
      USER_SECTORS_TABLE,
      new TableForeignKey({
        name: 'FK_user_sectors_user',
        columnNames: ['user_id'],
        referencedTableName: USERS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // 4. Foreign key: sector_id → sectors.id
    await queryRunner.createForeignKey(
      USER_SECTORS_TABLE,
      new TableForeignKey({
        name: 'FK_user_sectors_sector',
        columnNames: ['sector_id'],
        referencedTableName: SECTORS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // 5. Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE "${USER_SECTORS_TABLE}"
      IS 'Many-to-many: users ↔ sectors — controls sector-level access';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      USER_SECTORS_TABLE,
      'FK_user_sectors_sector',
    );
    await queryRunner.dropForeignKey(
      USER_SECTORS_TABLE,
      'FK_user_sectors_user',
    );
    await queryRunner.dropTable(USER_SECTORS_TABLE);
  }
}
