import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { SourceType, SourceStatus } from '@context-ai/shared';

/**
 * TypeORM Model for KnowledgeSource
 *
 * Maps the domain entity to database table.
 * Uses snake_case for column names (PostgreSQL convention).
 *
 * Features:
 * - UUID primary key
 * - Soft delete support (deletedAt)
 * - Indexes for performance
 * - JSON column for metadata
 *
 * Security:
 * - No sensitive data stored
 * - Metadata validation in entity layer
 */
@Entity('knowledge_sources')
@Index(['sector_id', 'status'])
@Index(['status'])
@Index(['deleted_at'])
export class KnowledgeSourceModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ name: 'sector_id', type: 'uuid' })
  @Index()
  sectorId!: string;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ['PDF', 'MARKDOWN', 'TEXT', 'URL'],
  })
  sourceType!: SourceType;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'],
    default: 'PENDING',
  })
  @Index()
  status!: SourceStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null = null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date = new Date();

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null = null;
}
