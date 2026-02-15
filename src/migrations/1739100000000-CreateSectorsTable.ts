import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Sectors Table
 *
 * Creates the `sectors` table for knowledge sector management.
 *
 * Features:
 * - UUID primary key
 * - Unique name (case-insensitive via unique index)
 * - Status (ACTIVE/INACTIVE)
 * - Icon identifier for frontend display
 * - Timestamps
 *
 * Adds a foreign key from knowledge_sources.sector_id → sectors.id
 * and seeds the initial sectors (Human Resources, Engineering, Sales).
 */
export class CreateSectorsTable1739100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sectors table
    await queryRunner.createTable(
      new Table({
        name: 'sectors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '30',
            isNullable: false,
            default: "'layout'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'ACTIVE'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Unique index on LOWER(name) for case-insensitive uniqueness
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_sectors_name_lower
      ON sectors (LOWER(name))
    `);

    // Index on status for filtering active/inactive
    await queryRunner.createIndex(
      'sectors',
      new TableIndex({
        name: 'idx_sectors_status',
        columnNames: ['status'],
      }),
    );

    // Check constraint for status values
    await queryRunner.query(`
      ALTER TABLE sectors
      ADD CONSTRAINT chk_sectors_status
      CHECK (status IN ('ACTIVE', 'INACTIVE'))
    `);

    // Check constraint for icon values
    await queryRunner.query(`
      ALTER TABLE sectors
      ADD CONSTRAINT chk_sectors_icon
      CHECK (icon IN ('code', 'users', 'trending-up', 'layout', 'heart', 'briefcase', 'building', 'globe', 'shield', 'lightbulb', 'book', 'megaphone'))
    `);

    // Seed initial sectors (matching the frontend SEED_SECTORS)
    await queryRunner.query(`
      INSERT INTO sectors (id, name, description, icon, status) VALUES
        ('440e8400-e29b-41d4-a716-446655440000', 'Human Resources',
         'Company policies, benefits, onboarding guides, and employee handbook.',
         'users', 'ACTIVE'),
        ('440e8400-e29b-41d4-a716-446655440001', 'Engineering',
         'Technical documentation, architecture decisions, coding standards, and deployment processes.',
         'code', 'ACTIVE'),
        ('440e8400-e29b-41d4-a716-446655440002', 'Sales',
         'Playbooks, pitch decks, CRM guides, objection handling, and competitive analysis.',
         'trending-up', 'ACTIVE')
    `);

    // Add foreign key from knowledge_sources.sector_id → sectors.id
    // Note: Using IF NOT EXISTS check since sector_id column already exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_knowledge_sources_sector_id'
        ) THEN
          ALTER TABLE knowledge_sources
          ADD CONSTRAINT fk_knowledge_sources_sector_id
          FOREIGN KEY (sector_id) REFERENCES sectors(id)
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK from knowledge_sources
    await queryRunner.query(`
      ALTER TABLE knowledge_sources
      DROP CONSTRAINT IF EXISTS fk_knowledge_sources_sector_id
    `);

    // Drop sectors table (CASCADE drops indexes and constraints)
    await queryRunner.dropTable('sectors', true);
  }
}
