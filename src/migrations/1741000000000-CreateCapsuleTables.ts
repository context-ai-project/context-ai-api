import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Table name constants
const CAPSULES_TABLE = 'capsules';
const CAPSULE_SOURCES_TABLE = 'capsule_sources';
const CAPSULE_GENERATION_LOGS_TABLE = 'capsule_generation_logs';
const USERS_TABLE = 'users';
const SECTORS_TABLE = 'sectors';
const KNOWLEDGE_SOURCES_TABLE = 'knowledge_sources';

// Column type constants
const UUID_TYPE = 'uuid';
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';

/**
 * Migration: Create Capsule Tables (v2 Multimedia Capsules — Block A)
 *
 * Creates three tables for the multimedia capsule feature:
 * - capsules: Core capsule metadata, script, and media URLs
 * - capsule_sources: Many-to-many join between capsules and knowledge sources
 * - capsule_generation_logs: Per-step audit log for the generation pipeline
 *
 * Dependencies:
 * - Requires `users` table to exist
 * - Requires `sectors` table to exist
 * - Requires `knowledge_sources` table to exist
 */
export class CreateCapsuleTables1741000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== 1. CAPSULES TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: CAPSULES_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: VARCHAR_TYPE,
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sector_id',
            type: UUID_TYPE,
            isNullable: false,
          },
          {
            name: 'type',
            type: VARCHAR_TYPE,
            length: '10',
            isNullable: false,
            default: "'AUDIO'",
          },
          {
            name: 'status',
            type: VARCHAR_TYPE,
            length: '15',
            isNullable: false,
            default: "'DRAFT'",
          },
          {
            name: 'intro_text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'script',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'audio_url',
            type: VARCHAR_TYPE,
            length: '512',
            isNullable: true,
          },
          {
            name: 'video_url',
            type: VARCHAR_TYPE,
            length: '512',
            isNullable: true,
          },
          {
            name: 'thumbnail_url',
            type: VARCHAR_TYPE,
            length: '512',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'audio_voice_id',
            type: VARCHAR_TYPE,
            length: '100',
            isNullable: true,
          },
          {
            name: 'generation_metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: UUID_TYPE,
            isNullable: false,
          },
          {
            name: 'published_at',
            type: TIMESTAMP_TZ,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Check constraints for capsules
    await queryRunner.query(`
      ALTER TABLE "${CAPSULES_TABLE}"
      ADD CONSTRAINT "chk_capsules_type"
      CHECK (type IN ('VIDEO', 'AUDIO', 'BOTH'))
    `);

    await queryRunner.query(`
      ALTER TABLE "${CAPSULES_TABLE}"
      ADD CONSTRAINT "chk_capsules_status"
      CHECK (status IN ('DRAFT', 'GENERATING', 'COMPLETED', 'ACTIVE', 'FAILED', 'ARCHIVED'))
    `);

    // Foreign keys for capsules
    await queryRunner.createForeignKey(
      CAPSULES_TABLE,
      new TableForeignKey({
        name: 'FK_capsules_sector_id',
        columnNames: ['sector_id'],
        referencedTableName: SECTORS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      CAPSULES_TABLE,
      new TableForeignKey({
        name: 'FK_capsules_created_by',
        columnNames: ['created_by'],
        referencedTableName: USERS_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    // Indexes for capsules
    await queryRunner.createIndex(
      CAPSULES_TABLE,
      new TableIndex({
        name: 'idx_capsules_sector_id',
        columnNames: ['sector_id'],
      }),
    );
    await queryRunner.createIndex(
      CAPSULES_TABLE,
      new TableIndex({ name: 'idx_capsules_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      CAPSULES_TABLE,
      new TableIndex({
        name: 'idx_capsules_created_by',
        columnNames: ['created_by'],
      }),
    );
    await queryRunner.createIndex(
      CAPSULES_TABLE,
      new TableIndex({ name: 'idx_capsules_type', columnNames: ['type'] }),
    );
    await queryRunner.createIndex(
      CAPSULES_TABLE,
      new TableIndex({
        name: 'idx_capsules_sector_status',
        columnNames: ['sector_id', 'status'],
      }),
    );

    // ==================== 2. CAPSULE_SOURCES TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: CAPSULE_SOURCES_TABLE,
        columns: [
          { name: 'capsule_id', type: UUID_TYPE, isNullable: false },
          { name: 'source_id', type: UUID_TYPE, isNullable: false },
        ],
      }),
      true,
    );

    // Composite primary key
    await queryRunner.query(`
      ALTER TABLE "${CAPSULE_SOURCES_TABLE}"
      ADD CONSTRAINT "PK_capsule_sources"
      PRIMARY KEY ("capsule_id", "source_id")
    `);

    // Foreign keys for capsule_sources
    await queryRunner.createForeignKey(
      CAPSULE_SOURCES_TABLE,
      new TableForeignKey({
        name: 'FK_capsule_sources_capsule',
        columnNames: ['capsule_id'],
        referencedTableName: CAPSULES_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      CAPSULE_SOURCES_TABLE,
      new TableForeignKey({
        name: 'FK_capsule_sources_knowledge_source',
        columnNames: ['source_id'],
        referencedTableName: KNOWLEDGE_SOURCES_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      }),
    );

    // Index for reverse lookup (knowledge_source → capsules)
    await queryRunner.createIndex(
      CAPSULE_SOURCES_TABLE,
      new TableIndex({
        name: 'idx_capsule_sources_source_id',
        columnNames: ['source_id'],
      }),
    );

    // ==================== 3. CAPSULE_GENERATION_LOGS TABLE ====================
    await queryRunner.createTable(
      new Table({
        name: CAPSULE_GENERATION_LOGS_TABLE,
        columns: [
          {
            name: 'id',
            type: UUID_TYPE,
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'capsule_id', type: UUID_TYPE, isNullable: false },
          {
            name: 'step',
            type: VARCHAR_TYPE,
            length: '20',
            isNullable: false,
          },
          {
            name: 'status',
            type: VARCHAR_TYPE,
            length: '15',
            isNullable: false,
          },
          {
            name: 'started_at',
            type: TIMESTAMP_TZ,
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'completed_at',
            type: TIMESTAMP_TZ,
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Check constraints for generation logs
    await queryRunner.query(`
      ALTER TABLE "${CAPSULE_GENERATION_LOGS_TABLE}"
      ADD CONSTRAINT "chk_capsule_logs_step"
      CHECK (step IN ('SCRIPT', 'AUDIO', 'VIDEO', 'POSTPROCESS'))
    `);

    await queryRunner.query(`
      ALTER TABLE "${CAPSULE_GENERATION_LOGS_TABLE}"
      ADD CONSTRAINT "chk_capsule_logs_status"
      CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED'))
    `);

    // Foreign key for generation logs
    await queryRunner.createForeignKey(
      CAPSULE_GENERATION_LOGS_TABLE,
      new TableForeignKey({
        name: 'FK_capsule_generation_logs_capsule',
        columnNames: ['capsule_id'],
        referencedTableName: CAPSULES_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Indexes for generation logs
    await queryRunner.createIndex(
      CAPSULE_GENERATION_LOGS_TABLE,
      new TableIndex({
        name: 'idx_capsule_logs_capsule_id',
        columnNames: ['capsule_id'],
      }),
    );
    await queryRunner.createIndex(
      CAPSULE_GENERATION_LOGS_TABLE,
      new TableIndex({
        name: 'idx_capsule_logs_capsule_step',
        columnNames: ['capsule_id', 'step'],
      }),
    );

    // Table comments
    await queryRunner.query(`
      COMMENT ON TABLE "${CAPSULES_TABLE}"
      IS 'Multimedia capsules — AI-generated audio/video content from knowledge sources (v2 Block A)';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE "${CAPSULE_SOURCES_TABLE}"
      IS 'Many-to-many: capsules ↔ knowledge_sources — documents used to generate a capsule';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE "${CAPSULE_GENERATION_LOGS_TABLE}"
      IS 'Step-level audit log for the capsule generation pipeline (script → audio → video)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order due to foreign key constraints

    // 3. Generation logs
    await queryRunner.dropForeignKey(
      CAPSULE_GENERATION_LOGS_TABLE,
      'FK_capsule_generation_logs_capsule',
    );
    await queryRunner.dropTable(CAPSULE_GENERATION_LOGS_TABLE);

    // 2. Capsule sources join table
    await queryRunner.dropForeignKey(
      CAPSULE_SOURCES_TABLE,
      'FK_capsule_sources_knowledge_source',
    );
    await queryRunner.dropForeignKey(
      CAPSULE_SOURCES_TABLE,
      'FK_capsule_sources_capsule',
    );
    await queryRunner.dropTable(CAPSULE_SOURCES_TABLE);

    // 1. Capsules
    await queryRunner.dropForeignKey(CAPSULES_TABLE, 'FK_capsules_created_by');
    await queryRunner.dropForeignKey(CAPSULES_TABLE, 'FK_capsules_sector_id');
    await queryRunner.dropTable(CAPSULES_TABLE);
  }
}
