import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  ITaskDispatcher,
  VideoTaskPayload,
} from '../../domain/services/task-dispatcher.interface';
import type { VideoPipelineService } from '../../application/services/video-pipeline.service';

@Injectable()
export class LocalTaskDispatcher implements ITaskDispatcher {
  private readonly logger = new Logger(LocalTaskDispatcher.name);

  constructor(
    @Inject('VideoPipelineService')
    private readonly pipeline: VideoPipelineService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async dispatchVideoGeneration(payload: VideoTaskPayload): Promise<void> {
    this.logger.log(
      `[DEV] Dispatching local video generation for capsule ${payload.capsuleId}`,
    );

    setImmediate(() => {
      this.pipeline
        .processVideo(payload.capsuleId, payload.voiceId)
        .catch((error: unknown) => {
          this.logger.error(
            `[DEV] Video pipeline failed for capsule ${payload.capsuleId}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    });
  }
}
