import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Remove pgvector Extension & Embedding Column
 *
 * Phase 6B.4 - Pinecone Migration
 *
 * This migration removes the pgvector infrastructure from PostgreSQL:
 * 1. Drops the HNSW similarity search index
 * 2. Drops the embedding vector column from fragments table
 * 3. Drops the pgvector extension
 *
 * Vector embeddings are now managed by Pinecone (IVectorStore).
 * PostgreSQL only stores relational/text data.
 *
 * IMPORTANT: Run the data migration script BEFORE this migration:
 *   npx ts-node scripts/migrate-vectors-to-pinecone.ts
 *
 * Execution Order:
 * 1. Run data migration script (populate Pinecone from existing embeddings)
 * 2. Verify Pinecone data integrity
 * 3. Run this TypeORM migration (remove pgvector schema)
 */
export class RemovePgvectorEmbeddings1739000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop HNSW similarity search index
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_fragments_embedding_hnsw`,
    );

    // Step 2: Drop the embedding vector column
    await queryRunner.query(
      `ALTER TABLE fragments DROP COLUMN IF EXISTS embedding`,
    );

    // Step 3: Drop the pgvector extension
    // CASCADE will drop any remaining dependent objects
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Recreate pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Step 2: Recreate embedding column (3072 dimensions for gemini-embedding-001)
    await queryRunner.query(
      `ALTER TABLE fragments ADD COLUMN embedding vector(3072)`,
    );

    // Step 3: Recreate HNSW index for vector similarity search
    await queryRunner.query(`
      CREATE INDEX idx_fragments_embedding_hnsw
      ON fragments
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }
}
