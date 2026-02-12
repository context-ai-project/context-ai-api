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
 * - Indexes for performance
 * - JSON column for metadata
 *
 * Note: Vector embeddings are stored externally in Pinecone.
 * The fragment ID is used as the vector ID in Pinecone.
 * PostgreSQL only stores relational/text data.
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
