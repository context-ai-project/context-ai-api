import { Injectable, Inject, Logger } from '@nestjs/common';
import { extractErrorMessage } from '@shared/utils';
import { parseVideoScenes } from '../../domain/value-objects/video-scene.vo';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import type { IImageGenerator } from '../../domain/services/image-generator.interface';
import type { IAudioGenerator } from '../../domain/services/audio-generator.interface';
import type {
  IMediaStorage,
  UploadResult,
} from '../../domain/services/media-storage.interface';
import type {
  IVideoRenderer,
  VideoTimelineRequest,
} from '../../domain/services/video-renderer.interface';
import type { Capsule } from '../../domain/entities/capsule.entity';
import { NotificationService } from '../../../notifications/application/notification.service';
import { NotificationType } from '@shared/types';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

const RENDER_POLL_INTERVAL_MS = 10_000;
const MAX_RENDER_POLL_ATTEMPTS = 60;

const PROGRESS = {
  SCRIPT: 5,
  IMAGES_START: 10,
  IMAGES_DONE: 40,
  AUDIO_START: 40,
  AUDIO_DONE: 60,
  RENDER_SUBMIT: 65,
  RENDER_POLL: 70,
  UPLOAD: 90,
  DONE: 100,
} as const;

@Injectable()
export class VideoPipelineService {
  private readonly logger = new Logger(VideoPipelineService.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepo: ICapsuleRepository,
    @Inject('IImageGenerator')
    private readonly imageGenerator: IImageGenerator,
    @Inject('IAudioGenerator')
    private readonly audioGenerator: IAudioGenerator,
    @Inject('IMediaStorage')
    private readonly mediaStorage: IMediaStorage,
    @Inject('IVideoRenderer')
    private readonly videoRenderer: IVideoRenderer,
    private readonly notificationService: NotificationService,
  ) {}

  async processVideo(capsuleId: string, voiceId: string): Promise<void> {
    this.logger.log(`Starting video pipeline for capsule ${capsuleId}`);

    const capsule = await this.capsuleRepo.findById(capsuleId);
    if (!capsule) {
      throw new Error(`Capsule ${capsuleId} not found`);
    }

    const tempPaths: string[] = [];

    try {
      // ── Step 1: Parse scenes (progress 5%) ──
      await this.updateProgress(capsule, PROGRESS.SCRIPT, 'SCRIPT');

      const scenesJson =
        (capsule.generationMetadata?.['scenesJson'] as string | undefined) ??
        capsule.script ??
        '';
      const scenes = parseVideoScenes(scenesJson);

      // ── Step 2: Generate images (progress 10% → 40%) ──
      await this.updateProgress(capsule, PROGRESS.IMAGES_START, 'IMAGES');
      const imageUploads = await this.generateAndUploadImages(
        capsule,
        scenes.map((s) => s.visualPrompt),
        tempPaths,
      );
      await this.updateProgress(capsule, PROGRESS.IMAGES_DONE, 'IMAGES');

      // ── Step 3: Generate audio (progress 40% → 60%) ──
      await this.updateProgress(capsule, PROGRESS.AUDIO_START, 'AUDIO');
      const audioResult = await this.generateAndUploadAudio(
        capsule,
        scenes.map((s) => s.textToNarrate).join(' '),
        voiceId,
        tempPaths,
      );
      await this.updateProgress(capsule, PROGRESS.AUDIO_DONE, 'AUDIO');

      // ── Step 4: Submit render to Shotstack (progress 65%) ──
      capsule.startRendering();
      await this.updateProgress(capsule, PROGRESS.RENDER_SUBMIT, 'RENDERING');

      const signedImageUrls = await Promise.all(
        imageUploads.map((upload) =>
          this.mediaStorage.getSignedUrl(upload.path),
        ),
      );

      const timelineScenes = scenes.map((scene, i) => ({
        ...scene,
        imageUrl: signedImageUrls[i],
      }));
      const timeline: VideoTimelineRequest = {
        scenes: timelineScenes,
        audioUrl: audioResult.audioSignedUrl,
        audioDurationSeconds: audioResult.durationSeconds,
      };

      const renderId = await this.videoRenderer.renderVideo(timeline);

      // ── Step 5: Poll render status (progress 70% → 90%) ──
      await this.updateProgress(capsule, PROGRESS.RENDER_POLL, 'RENDERING');
      const renderResult = await this.pollRender(renderId);

      if (renderResult.status === 'failed') {
        throw new Error(
          `Shotstack render failed: ${renderResult.errorMessage ?? 'unknown'}`,
        );
      }

      // ── Step 6: Download & upload final video (progress 90% → 95%) ──
      await this.updateProgress(capsule, PROGRESS.UPLOAD, 'UPLOAD');
      const finalVideo = await this.downloadAndUploadFinal(
        capsule,
        renderResult.url!,
      );

      // ── Step 7: Complete (progress 100%) ──
      capsule.completeGeneration({
        videoUrl: finalVideo.path,
        audioUrl: audioResult.audioPath,
        durationSeconds: audioResult.durationSeconds,
        metadata: {
          renderId,
          shotstackUrl: renderResult.url,
          progress: PROGRESS.DONE,
          step: 'DONE',
        },
      });
      await this.capsuleRepo.save(capsule);

      await this.notifyGenerationComplete(capsule);
      this.logger.log(`Video pipeline completed for capsule ${capsuleId}`);
    } catch (error: unknown) {
      await this.handleFailure(capsule, error);
    } finally {
      await this.cleanupTempFiles(tempPaths);
    }
  }

  private async notifyGenerationComplete(capsule: Capsule): Promise<void> {
    try {
      const typeLabel = capsule.type === CapsuleType.VIDEO ? 'Video' : 'Audio';
      await this.notificationService.create({
        userId: capsule.createdBy,
        type: NotificationType.CAPSULE_GENERATED,
        title: `${typeLabel} capsule ready`,
        message: `Your ${typeLabel} capsule "${capsule.title}" has been generated and is ready to view.`,
        metadata: {
          capsuleId: capsule.id,
          capsuleType: typeLabel,
          capsuleTitle: capsule.title,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to send generation notification for capsule ${capsule.id}: ${extractErrorMessage(error)}`,
      );
    }
  }

  private async updateProgress(
    capsule: Capsule,
    progress: number,
    step: string,
  ): Promise<void> {
    capsule.generationMetadata = {
      ...capsule.generationMetadata,
      progress,
      step,
    };
    await this.capsuleRepo.save(capsule);
  }

  private async generateAndUploadImages(
    capsule: Capsule,
    prompts: string[],
    tempPaths: string[],
  ): Promise<UploadResult[]> {
    this.logger.log(`Generating ${prompts.length} images in parallel`);

    const results: (UploadResult | null)[] = new Array<UploadResult | null>(
      prompts.length,
    ).fill(null);

    const generateOne = async (
      prompt: string,
      index: number,
    ): Promise<void> => {
      const imageBuffer = await this.imageGenerator.generateImage(prompt);
      const storagePath = `capsules/${capsule.id}/temp/scene-${index}.png`;
      tempPaths.push(storagePath);
      results[index] = await this.mediaStorage.upload(
        imageBuffer,
        storagePath,
        'image/png',
      );
    };

    // First pass: all in parallel, tolerating individual failures
    const firstPass = await Promise.allSettled(
      prompts.map((prompt, index) => generateOne(prompt, index)),
    );

    // Retry failed images once (Imagen can intermittently return empty results)
    const failedIndices = firstPass
      .map((r, i) => (r.status === 'rejected' ? i : -1))
      .filter((i) => i >= 0);

    if (failedIndices.length > 0) {
      this.logger.warn(
        `${failedIndices.length}/${prompts.length} images failed on first attempt — retrying`,
      );
      const retries = await Promise.allSettled(
        failedIndices.map((i) => generateOne(prompts[i], i)),
      );

      const stillFailed = retries
        .map((r, idx) => (r.status === 'rejected' ? failedIndices[idx] : -1))
        .filter((i) => i >= 0);

      if (stillFailed.length > 0) {
        throw new Error(
          `Image generation failed for ${stillFailed.length} scenes after retry (indices: ${stillFailed.join(', ')})`,
        );
      }
    }

    return results as UploadResult[];
  }

  private async generateAndUploadAudio(
    capsule: Capsule,
    fullNarration: string,
    voiceId: string,
    tempPaths: string[],
  ): Promise<{
    audioPath: string;
    audioSignedUrl: string;
    durationSeconds: number;
  }> {
    this.logger.log('Generating audio narration');

    const audioResult = await this.audioGenerator.generateAudio(fullNarration, {
      voiceId,
    });
    const storagePath = `capsules/${capsule.id}/temp/audio.mp3`;
    tempPaths.push(storagePath);

    await this.mediaStorage.upload(
      audioResult.audioBuffer,
      storagePath,
      audioResult.contentType,
    );
    const signedUrl = await this.mediaStorage.getSignedUrl(storagePath);

    return {
      audioPath: storagePath,
      audioSignedUrl: signedUrl,
      durationSeconds: audioResult.durationSeconds,
    };
  }

  private async pollRender(
    renderId: string,
  ): Promise<{ status: string; url?: string; errorMessage?: string }> {
    for (let attempt = 0; attempt < MAX_RENDER_POLL_ATTEMPTS; attempt++) {
      const status = await this.videoRenderer.getRenderStatus(renderId);

      if (status.status === 'done' || status.status === 'failed') {
        return status;
      }

      this.logger.debug(
        `Render ${renderId}: ${status.status} (attempt ${attempt + 1})`,
      );
      await this.sleep(RENDER_POLL_INTERVAL_MS);
    }

    return {
      status: 'failed',
      errorMessage: `Render polling timed out after ${MAX_RENDER_POLL_ATTEMPTS} attempts`,
    };
  }

  private async downloadAndUploadFinal(
    capsule: Capsule,
    videoUrl: string,
  ): Promise<UploadResult> {
    this.logger.log('Downloading final video from Shotstack');

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download video: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const finalPath = `capsules/${capsule.id}/video.mp4`;

    return this.mediaStorage.upload(buffer, finalPath, 'video/mp4');
  }

  private async handleFailure(capsule: Capsule, error: unknown): Promise<void> {
    const message = extractErrorMessage(error);
    this.logger.error(
      `Video pipeline failed for capsule ${capsule.id}: ${message}`,
    );

    try {
      capsule.failGeneration({
        reason: message,
        failedAt: new Date().toISOString(),
      });
      await this.capsuleRepo.save(capsule);
    } catch (saveError: unknown) {
      this.logger.error(
        `Failed to save failure state: ${extractErrorMessage(saveError)}`,
      );
    }
  }

  private async cleanupTempFiles(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await this.mediaStorage.delete(path);
      } catch {
        this.logger.warn(`Failed to cleanup temp file: ${path}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
