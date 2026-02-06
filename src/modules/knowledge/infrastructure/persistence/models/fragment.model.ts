import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * TypeORM Model for Fragment
 *
 * Maps the domain entity to database table.
 * Uses snake_case for column names (PostgreSQL convention).
 *
 * Features:
 * - UUID primary key
 * - pgvector support for embeddings
 * - Indexes for performance (including vector index)
 * - JSON column for metadata
 *
 * pgvector Configuration:
 * - Embedding column uses 'vector' type
 * - Supports 768 or 1536 dimensions
 * - IVFFlat index for fast similarity search
 *
 * Security:
 * - Content validation in entity layer
 * - Token count limits enforced
 */
@Entity('fragments')
@Index(['sourceId'])
@Index(['position'])
export class FragmentModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Column({ type: 'text' })
  content!: string;

  /**
   * Vector embedding column
   * Uses pgvector extension
   * Default: 768 dimensions (text-embedding-005 default)
   * Can be 256, 512, 768, or 1536 dimensions
   */
  @Column({
    type: 'vector',
    nullable: true,
  })
  embedding!: string | null;

  @Column({ type: 'int' })
  position!: number;

  @Column({ name: 'token_count', type: 'int' })
  tokenCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
