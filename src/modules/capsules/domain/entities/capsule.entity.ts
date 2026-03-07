import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';

/**
 * Minimal source reference stored within the Capsule aggregate.
 */
export interface CapsuleSourceRef {
  id: string;
  title: string;
  sourceType: string;
}

/**
 * Capsule Entity (Aggregate Root)
 *
 * Represents a multimedia capsule — AI-generated audio (Block A) or video
 * (Block B) content derived from a set of knowledge source documents.
 *
 * Business rules:
 * - Title is required and must be 3–255 characters
 * - sectorId and createdBy are immutable after creation
 * - At least one sourceId must be associated
 * - Status transitions are strictly controlled
 * - Script generation requires DRAFT or COMPLETED status
 * - Audio generation requires a non-empty script and a voiceId
 * - Publishing requires COMPLETED status
 * - Archiving is allowed from ACTIVE or COMPLETED
 */
export class Capsule {
  public id?: string;
  public title: string;
  public description: string | null;
  public sectorId: string;
  public type: CapsuleType;
  public status: CapsuleStatus;
  public introText: string | null;
  public script: string | null;
  public audioUrl: string | null;
  public videoUrl: string | null;
  public thumbnailUrl: string | null;
  public durationSeconds: number | null;
  public audioVoiceId: string | null;
  public language: string | null;
  public generationMetadata: Record<string, unknown> | null;
  public createdBy: string;
  public publishedAt: Date | null;
  public createdAt: Date;
  public updatedAt: Date;
  public sources: CapsuleSourceRef[];

  static readonly TITLE_MIN_LENGTH = 3;
  static readonly TITLE_MAX_LENGTH = 255;

  constructor(data: {
    title: string;
    sectorId: string;
    type: CapsuleType;
    createdBy: string;
    sourceIds?: string[];
    introText?: string;
  }) {
    this.validateTitle(data.title);

    this.title = data.title.trim();
    this.description = null;
    this.sectorId = data.sectorId;
    this.type = data.type;
    this.status = CapsuleStatus.DRAFT;
    this.introText = data.introText?.trim() ?? null;
    this.script = null;
    this.audioUrl = null;
    this.videoUrl = null;
    this.thumbnailUrl = null;
    this.durationSeconds = null;
    this.audioVoiceId = null;
    this.language = null;
    this.generationMetadata = null;
    this.createdBy = data.createdBy;
    this.publishedAt = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.sources = [];
  }

  // ==================== Validation ====================

  private validateTitle(title: string): void {
    const trimmed = title?.trim();
    if (!trimmed) {
      throw new Error('Capsule title cannot be empty');
    }
    if (trimmed.length < Capsule.TITLE_MIN_LENGTH) {
      throw new Error(
        `Capsule title must be at least ${Capsule.TITLE_MIN_LENGTH} characters`,
      );
    }
    if (trimmed.length > Capsule.TITLE_MAX_LENGTH) {
      throw new Error(
        `Capsule title cannot exceed ${Capsule.TITLE_MAX_LENGTH} characters`,
      );
    }
  }

  // ==================== Status Checks ====================

  public isDraft(): boolean {
    return this.status === CapsuleStatus.DRAFT;
  }

  public isGenerating(): boolean {
    return this.status === CapsuleStatus.GENERATING;
  }

  public isCompleted(): boolean {
    return this.status === CapsuleStatus.COMPLETED;
  }

  public isActive(): boolean {
    return this.status === CapsuleStatus.ACTIVE;
  }

  public isFailed(): boolean {
    return this.status === CapsuleStatus.FAILED;
  }

  public isArchived(): boolean {
    return this.status === CapsuleStatus.ARCHIVED;
  }

  public isEditable(): boolean {
    return this.isDraft() || this.isCompleted() || this.isFailed();
  }

  public canGenerateScript(): boolean {
    return this.isDraft() || this.isCompleted() || this.isFailed();
  }

  public canGenerateAudio(): boolean {
    return (
      this.canGenerateScript() &&
      this.script !== null &&
      this.script.trim().length > 0 &&
      this.audioVoiceId !== null
    );
  }

  // ==================== State Transitions ====================

  /**
   * Marks the capsule as starting the generation pipeline.
   * Allowed from: DRAFT, COMPLETED, FAILED
   */
  public startGeneration(): void {
    if (!this.canGenerateScript()) {
      throw new Error(
        `Cannot start generation from status "${this.status}". ` +
          `Allowed statuses: DRAFT, COMPLETED, FAILED`,
      );
    }
    this.status = CapsuleStatus.GENERATING;
    this.updatedAt = new Date();
  }

  /**
   * Marks the generation pipeline as successfully completed.
   * Called after audio (Block A) or video (Block B) is uploaded.
   */
  public completeGeneration(data: {
    audioUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.isGenerating()) {
      throw new Error(
        `Cannot complete generation from status "${this.status}". Expected: GENERATING`,
      );
    }
    if (data.audioUrl) this.audioUrl = data.audioUrl;
    if (data.videoUrl) this.videoUrl = data.videoUrl;
    if (data.thumbnailUrl) this.thumbnailUrl = data.thumbnailUrl;
    if (data.durationSeconds !== undefined)
      this.durationSeconds = data.durationSeconds;
    if (data.metadata) this.generationMetadata = data.metadata;
    this.status = CapsuleStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Marks the generation pipeline as failed.
   * The script is preserved so the user can retry.
   */
  public failGeneration(errorDetails?: Record<string, unknown>): void {
    if (!this.isGenerating()) {
      throw new Error(
        `Cannot mark generation as failed from status "${this.status}". Expected: GENERATING`,
      );
    }
    if (errorDetails) {
      this.generationMetadata = {
        ...this.generationMetadata,
        error: errorDetails,
      };
    }
    this.status = CapsuleStatus.FAILED;
    this.updatedAt = new Date();
  }

  /**
   * Updates the AI-generated script and optional description.
   * Allowed in DRAFT, COMPLETED, or FAILED.
   */
  public updateScript(
    script: string,
    description?: string,
    language?: string,
  ): void {
    if (!this.canGenerateScript()) {
      throw new Error(
        `Cannot update script when capsule is in status "${this.status}"`,
      );
    }
    this.script = script;
    if (description !== undefined) {
      this.description = description || null;
    }
    if (language !== undefined) {
      this.language = language || null;
    }
    this.updatedAt = new Date();
  }

  /**
   * Publishes the capsule making it visible to end users.
   * Only allowed from COMPLETED status.
   */
  public publish(): void {
    if (!this.isCompleted()) {
      throw new Error(
        `Cannot publish capsule in status "${this.status}". Expected: COMPLETED`,
      );
    }
    this.status = CapsuleStatus.ACTIVE;
    this.publishedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Archives the capsule making it invisible to end users.
   * Semantic transition used by the "Archive" action in the player UI.
   * Allowed from ACTIVE or COMPLETED.
   */
  public archive(): void {
    if (!this.isActive() && !this.isCompleted()) {
      throw new Error(
        `Cannot archive capsule in status "${this.status}". Allowed: ACTIVE, COMPLETED`,
      );
    }
    this.status = CapsuleStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  /**
   * Soft-deletes the capsule regardless of its current status.
   * Used by the "Delete" action in the UI — any non-archived capsule can be deleted.
   * (DRAFT, GENERATING, COMPLETED, ACTIVE, FAILED → ARCHIVED)
   */
  public softDelete(): void {
    if (this.isArchived()) {
      throw new Error(`Capsule is already archived/deleted`);
    }
    this.status = CapsuleStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  // ==================== Update ====================

  /**
   * Updates editable fields. Only allowed in DRAFT, COMPLETED, or FAILED.
   */
  public update(data: {
    title?: string;
    introText?: string;
    script?: string;
    audioVoiceId?: string;
  }): void {
    if (!this.isEditable()) {
      throw new Error(
        `Cannot update capsule in status "${this.status}". Allowed: DRAFT, COMPLETED, FAILED`,
      );
    }

    if (data.title !== undefined) {
      this.validateTitle(data.title);
      this.title = data.title.trim();
    }
    if (data.introText !== undefined) {
      this.introText = data.introText.trim() || null;
    }
    if (data.script !== undefined) {
      this.script = data.script || null;
    }
    if (data.audioVoiceId !== undefined) {
      this.audioVoiceId = data.audioVoiceId || null;
    }

    this.updatedAt = new Date();
  }
}
