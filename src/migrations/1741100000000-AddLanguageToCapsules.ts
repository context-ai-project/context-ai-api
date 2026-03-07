import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const CAPSULES_TABLE = 'capsules';

/**
 * Migration: Add language column to capsules table
 *
 * Stores the BCP-47 language code of the AI-generated script
 * (e.g. "es-ES", "en-US"). Nullable to preserve existing rows.
 */
export class AddLanguageToCapsules1741100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      CAPSULES_TABLE,
      new TableColumn({
        name: 'language',
        type: 'varchar',
        length: '10',
        isNullable: true,
        comment:
          'BCP-47 language code of the AI-generated script (e.g. "es-ES", "en-US")',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(CAPSULES_TABLE, 'language');
  }
}
