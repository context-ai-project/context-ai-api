import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import type { IAudioGenerator } from '../../domain/services/audio-generator.interface';
import type { IMediaStorage } from '../../domain/services/media-storage.interface';

// Storage path convention
const AUDIO_STORAGE_PATH = (capsuleId: string) =>
  `capsules/${capsuleId}/audio.mp3`;
const AUDIO_CONTENT_TYPE = 'audio/mpeg';

/**
 * Generate Audio Use Case
 *
 * Orchestrates the full audio generation pipeline:
 * 1. Validates capsule has script and voiceId
 * 2. Transitions status → GENERATING (synchronous — fast)
 * 3. Synthesizes audio via IAudioGenerator (ElevenLabs)
 * 4. Uploads result to IMediaStorage (GCS)
 * 5. Transitions status → COMPLETED with audioUrl and duration
 * 6. On failure: transitions to FAILED, preserves script
 *
 * The controller calls `startAndProcess()` which:
 * - Awaits the validation + GENERATING transition (returns instantly to client)
 * - Runs the heavy pipeline in the background (fire-and-forget)
 */
@Injectable()
export class GenerateAudioUseCase {
  private readonly logger = new Logger(GenerateAudioUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
    @Inject('IAudioGenerator')
    private readonly audioGenerator: IAudioGenerator,
    @Inject('IMediaStorage')
    private readonly mediaStorage: IMediaStorage,
  ) {}

  /**
   * Phase 1 (synchronous): validate inputs and transition to GENERATING.
   * Called by the controller — returns quickly so the HTTP 202 fires immediately.
   *
   * Phase 2 (background): kicks off the heavy TTS + upload pipeline.
   * The caller does NOT await the returned promise of phase 2 — it runs
   * in the background and the client polls GET /capsules/:id/status.
   */
  async startAndProcess(capsuleId: string, voiceId: string): Promise<void> {
    // ── Phase 1: validate + start (synchronous) ──────────────────────
    await this.validateAndStart(capsuleId, voiceId);

    // ── Phase 2: heavy pipeline (fire-and-forget) ────────────────────
    // We intentionally do NOT await this — it runs in the background.
    // Errors are caught internally and transition the capsule to FAILED.
    this.processAudioPipeline(capsuleId, voiceId).catch((error: unknown) => {
      this.logger.error(
        `Background audio pipeline failed for capsule ${capsuleId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  /**
   * Validates the capsule and transitions it to GENERATING status.
   * This is the synchronous, fast part that runs before HTTP 202.
   */
  private async validateAndStart(
    capsuleId: string,
    voiceId: string,
  ): Promise<void> {
    this.logger.log(`Validating audio generation for capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    if (!capsule.script?.trim()) {
      throw new BadRequestException(
        'Capsule must have a script before generating audio',
      );
    }

    // Set voiceId on the entity so canGenerateAudio() passes
    capsule.update({ audioVoiceId: voiceId });

    if (!capsule.canGenerateAudio()) {
      throw new BadRequestException(
        `Cannot generate audio for capsule in status "${capsule.status}". ` +
          `Allowed: DRAFT, COMPLETED, FAILED`,
      );
    }

    // Transition to GENERATING and persist
    capsule.startGeneration();
    await this.capsuleRepository.save(capsule);

    this.logger.log(
      `Capsule ${capsuleId} transitioned to GENERATING — starting background pipeline`,
    );
  }

  /**
   * The heavy audio pipeline: TTS synthesis → upload → mark COMPLETED.
   * Runs in the background after the HTTP 202 has been sent.
   * On failure, transitions the capsule to FAILED.
   */
  private async processAudioPipeline(
    capsuleId: string,
    voiceId: string,
  ): Promise<void> {
    // Re-fetch from DB so we have a fresh entity (not the one from phase 1)
    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      this.logger.error(
        `Capsule ${capsuleId} not found during background pipeline`,
      );
      return;
    }

    try {
      // Initialize progress metadata
      capsule.generationMetadata = { progress: 0, step: 'AUDIO' };
      await this.capsuleRepository.save(capsule);

      // 1. Synthesize audio via ElevenLabs — persist progress per chunk
      // Progress 0-80% = TTS chunks, 80-90% = upload, 90-100% = done
      const audioResult = await this.audioGenerator.generateAudio(
        capsule.script!,
        { voiceId },
        async (completed: number, total: number) => {
          const AUDIO_PROGRESS_MAX = 80;
          const progress = Math.round((completed / total) * AUDIO_PROGRESS_MAX);
          capsule.generationMetadata = {
            ...capsule.generationMetadata,
            progress,
            chunksCompleted: completed,
            chunksTotal: total,
          };
          await this.capsuleRepository.save(capsule);
        },
      );

      // 2. Upload to cloud storage (progress: 80 → 90%)
      const UPLOAD_PROGRESS = 90;
      capsule.generationMetadata = {
        ...capsule.generationMetadata,
        progress: UPLOAD_PROGRESS,
        step: 'UPLOAD',
      };
      await this.capsuleRepository.save(capsule);

      const storagePath = AUDIO_STORAGE_PATH(capsuleId);
      await this.mediaStorage.upload(
        audioResult.audioBuffer,
        storagePath,
        AUDIO_CONTENT_TYPE,
      );

      // 3. Transition to COMPLETED (progress: 100%)
      capsule.completeGeneration({
        audioUrl: storagePath,
        durationSeconds: audioResult.durationSeconds,
        metadata: {
          voiceId,
          storagePath,
          generatedAt: new Date().toISOString(),
          audioSizeBytes: audioResult.audioBuffer.length,
          progress: 100,
          step: 'DONE',
        },
      });

      await this.capsuleRepository.save(capsule);

      this.logger.log(`Audio generation completed for capsule: ${capsuleId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Audio generation failed for capsule ${capsuleId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Only transition to FAILED if the capsule is still in GENERATING status.
      if (capsule.isGenerating()) {
        capsule.failGeneration({
          message: error instanceof Error ? error.message : String(error),
          failedAt: new Date().toISOString(),
        });
        await this.capsuleRepository.save(capsule);
      }
    }
  }
}
