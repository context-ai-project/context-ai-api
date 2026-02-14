import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Knowledge Tables
 *
 * Creates the initial database schema for the Knowledge Context module:
 * - knowledge_sources: Stores document metadata and content
 * - fragments: Stores document chunks with vector embeddings
 *
 * Features:
 * - UUIDs for primary keys
 * - Timestamps (created_at, updated_at, deleted_at)
 * - Soft delete support
 * - Vector column for embeddings (pgvector)
 * - Foreign key constraints
 * - Indexes for performance
 * - Check constraints for data integrity
 */
export class CreateKnowledgeTables1707265200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create knowledge_sources table
    await queryRunner.createTable(
      new Table({
        name: 'knowledge_sources',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'sector_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to sector (will be added in auth module)',
          },
          {
            name: 'source_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'PDF, MARKDOWN, URL',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'PENDING'",
            comment: 'PENDING, PROCESSING, COMPLETED, FAILED',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional metadata (parsed date, file size, etc.)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Soft delete timestamp',
          },
        ],
      }),
      true,
    );

    // Create fragments table
    await queryRunner.createTable(
      new Table({
        name: 'fragments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'source_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Foreign key to knowledge_sources',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'embedding',
            type: 'vector(768)',
            isNullable: true,
            comment:
              'Vector embedding for similarity search (768 dimensions for Gemini)',
          },
          {
            name: 'position',
            type: 'integer',
            isNullable: false,
            comment: 'Position/order of fragment within the source document',
          },
          {
            name: 'token_count',
            type: 'integer',
            isNullable: false,
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional metadata (chunk range, overlap info, etc.)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE fragments
      ADD CONSTRAINT fk_fragments_source_id
      FOREIGN KEY (source_id)
      REFERENCES knowledge_sources(id)
      ON DELETE CASCADE
    `);

    // Create indexes for knowledge_sources
    await queryRunner.createIndex(
      'knowledge_sources',
      new TableIndex({
        name: 'idx_knowledge_sources_sector_id',
        columnNames: ['sector_id'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_sources',
      new TableIndex({
        name: 'idx_knowledge_sources_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_sources',
      new TableIndex({
        name: 'idx_knowledge_sources_source_type',
        columnNames: ['source_type'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_sources',
      new TableIndex({
        name: 'idx_knowledge_sources_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_sources',
      new TableIndex({
        name: 'idx_knowledge_sources_deleted_at',
        columnNames: ['deleted_at'],
        where: 'deleted_at IS NULL',
      }),
    );

    // Create indexes for fragments
    await queryRunner.createIndex(
      'fragments',
      new TableIndex({
        name: 'idx_fragments_source_id',
        columnNames: ['source_id'],
      }),
    );

    await queryRunner.createIndex(
      'fragments',
      new TableIndex({
        name: 'idx_fragments_position',
        columnNames: ['source_id', 'position'],
      }),
    );

    // Create vector similarity search index using HNSW
    // HNSW (Hierarchical Navigable Small World) is optimal for high-dimensional vectors
    await queryRunner.query(`
      CREATE INDEX idx_fragments_embedding_hnsw
      ON fragments
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // Create trigger to auto-update updated_at timestamp
    await queryRunner.query(`
      CREATE TRIGGER update_knowledge_sources_updated_at
      BEFORE UPDATE ON knowledge_sources
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_fragments_updated_at
      BEFORE UPDATE ON fragments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `);

    // Add check constraints for data integrity
    await queryRunner.query(`
      ALTER TABLE knowledge_sources
      ADD CONSTRAINT chk_knowledge_sources_status
      CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
    `);

    await queryRunner.query(`
      ALTER TABLE knowledge_sources
      ADD CONSTRAINT chk_knowledge_sources_source_type
      CHECK (source_type IN ('PDF', 'MARKDOWN', 'URL'))
    `);

    await queryRunner.query(`
      ALTER TABLE fragments
      ADD CONSTRAINT chk_fragments_position
      CHECK (position >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE fragments
      ADD CONSTRAINT chk_fragments_token_count
      CHECK (token_count >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_fragments_updated_at ON fragments`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_knowledge_sources_updated_at ON knowledge_sources`,
    );

    // Drop tables (CASCADE will drop foreign keys and indexes automatically)
    await queryRunner.dropTable('fragments', true);
    await queryRunner.dropTable('knowledge_sources', true);

    // Note: We don't drop the pgvector extension or update_updated_at_column function
    // as they might be used by other modules
  }
}
