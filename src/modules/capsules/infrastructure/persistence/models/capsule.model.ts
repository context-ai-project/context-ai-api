import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleGenerationLogModel } from './capsule-generation-log.model';

/**
 * TypeORM Model for Capsule
 *
 * Maps the Capsule domain entity to the `capsules` database table.
 * Follows snake_case column naming (PostgreSQL convention).
 *
 * Relationships:
 * - ManyToMany with KnowledgeSourceModel via capsule_sources join table
 * - OneToMany with CapsuleGenerationLogModel (pipeline audit logs)
 */
@Entity('capsules')
@Index(['sectorId', 'status'])
@Index(['status'])
@Index(['createdBy'])
export class CapsuleModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ name: 'sector_id', type: 'uuid' })
  sectorId!: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: CapsuleType.AUDIO,
  })
  type!: CapsuleType;

  @Column({
    type: 'varchar',
    length: 20,
    default: CapsuleStatus.DRAFT,
  })
  status!: CapsuleStatus;

  @Column({ name: 'intro_text', type: 'text', nullable: true })
  introText: string | null = null;

  @Column({ type: 'text', nullable: true })
  script: string | null = null;

  // Stores the GCS storage path (e.g. "capsules/{id}/audio.mp3"), not a signed URL.
  // Signed URLs are generated on demand via IMediaStorage.getSignedUrl().
  @Column({ name: 'audio_url', type: 'varchar', length: 1024, nullable: true })
  audioUrl: string | null = null;

  @Column({ name: 'video_url', type: 'varchar', length: 1024, nullable: true })
  videoUrl: string | null = null;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  thumbnailUrl: string | null = null;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds: number | null = null;

  @Column({
    name: 'audio_voice_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  audioVoiceId: string | null = null;

  // BCP-47 language code of the generated script (e.g. "es-ES", "en-US").
  // Populated when the AI script is generated; null for pre-language-feature capsules.
  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null = null;

  @Column({ name: 'generation_metadata', type: 'jsonb', nullable: true })
  generationMetadata: Record<string, unknown> | null = null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null = null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date = new Date();

  @OneToMany(() => CapsuleGenerationLogModel, (log) => log.capsule, {
    cascade: ['insert'],
  })
  generationLogs?: CapsuleGenerationLogModel[];

  // ManyToMany relationship — managed via capsule_sources join table
  // Lazy-loaded to avoid unintended N+1 queries
  @ManyToMany('KnowledgeSourceModel')
  @JoinTable({
    name: 'capsule_sources',
    joinColumn: { name: 'capsule_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'source_id', referencedColumnName: 'id' },
  })
  sources?: unknown[];
}
