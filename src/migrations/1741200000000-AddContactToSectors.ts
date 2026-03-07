import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const SECTORS_TABLE = 'sectors';

/**
 * Migration: Add contact fields to sectors table
 *
 * Adds contact_name and contact_phone to each sector so the chat assistant
 * can direct users to the right person when no documentation is available.
 */
export class AddContactToSectors1741200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(SECTORS_TABLE, [
      new TableColumn({
        name: 'contact_name',
        type: 'varchar',
        length: '150',
        isNullable: true,
        comment: 'Full name (first + last) of the sector responsible contact',
      }),
      new TableColumn({
        name: 'contact_phone',
        type: 'varchar',
        length: '30',
        isNullable: true,
        comment: 'Phone number of the sector responsible contact',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(SECTORS_TABLE, 'contact_phone');
    await queryRunner.dropColumn(SECTORS_TABLE, 'contact_name');
  }
}
