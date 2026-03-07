import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CapsuleGenerationStep } from '@shared/types/enums/capsule-generation-step.enum';
import { CapsuleModel } from './capsule.model';

/**
 * Log status values for a single generation step.
 */
export enum CapsuleLogStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * TypeORM Model for CapsuleGenerationLog
 *
 * Records the outcome of each step in the capsule generation pipeline.
 * Each row represents one attempt at one pipeline step for a capsule.
 *
 * Used for:
 * - Debugging failed generations
 * - Displaying progress to the user during generation
 * - Auditing generation cost (duration_ms, metadata)
 */
@Entity('capsule_generation_logs')
@Index(['capsuleId'])
@Index(['capsuleId', 'step'])
export class CapsuleGenerationLogModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'capsule_id', type: 'uuid' })
  capsuleId!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  step!: CapsuleGenerationStep;

  @Column({
    type: 'varchar',
    length: 15,
  })
  status!: CapsuleLogStatus;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date = new Date();

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null = null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs: number | null = null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null = null;

  @ManyToOne(() => CapsuleModel, (capsule) => capsule.generationLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'capsule_id' })
  capsule?: CapsuleModel;
}
