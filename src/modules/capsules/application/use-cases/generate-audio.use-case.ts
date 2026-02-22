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
 * 2. Transitions status → GENERATING
 * 3. Synthesizes audio via IAudioGenerator (ElevenLabs)
 * 4. Uploads result to IMediaStorage (GCS)
 * 5. Transitions status → COMPLETED with audioUrl and duration
 * 6. On failure: transitions to FAILED, preserves script
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

  async execute(capsuleId: string, voiceId: string): Promise<void> {
    this.logger.log(`Starting audio generation for capsule: ${capsuleId}`);

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

    // Transition to GENERATING
    capsule.startGeneration();
    await this.capsuleRepository.save(capsule);

    try {
      // 1. Synthesize audio
      const audioResult = await this.audioGenerator.generateAudio(
        capsule.script,
        { voiceId },
      );

      // 2. Upload to cloud storage
      const storagePath = AUDIO_STORAGE_PATH(capsuleId);
      await this.mediaStorage.upload(
        audioResult.audioBuffer,
        storagePath,
        AUDIO_CONTENT_TYPE,
      );

      // 3. Get signed URL for immediate playback
      const audioUrl = await this.mediaStorage.getSignedUrl(storagePath);

      // 4. Transition to COMPLETED
      capsule.completeGeneration({
        audioUrl,
        durationSeconds: audioResult.durationSeconds,
        metadata: {
          voiceId,
          storagePath,
          generatedAt: new Date().toISOString(),
          audioSizeBytes: audioResult.audioBuffer.length,
        },
      });

      await this.capsuleRepository.save(capsule);

      this.logger.log(`Audio generation completed for capsule: ${capsuleId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Audio generation failed for capsule ${capsuleId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Transition to FAILED, preserve script
      capsule.failGeneration({
        message: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
      });
      await this.capsuleRepository.save(capsule);

      throw error;
    }
  }
}
