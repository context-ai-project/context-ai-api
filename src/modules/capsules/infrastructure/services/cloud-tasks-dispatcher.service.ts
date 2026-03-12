import { Injectable, Logger } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';
import { extractErrorMessage } from '@shared/utils';
import type {
  ITaskDispatcher,
  VideoTaskPayload,
} from '../../domain/services/task-dispatcher.interface';

@Injectable()
export class CloudTasksDispatcher implements ITaskDispatcher {
  private readonly logger = new Logger(CloudTasksDispatcher.name);
  private readonly client: CloudTasksClient;
  private readonly queuePath: string;
  private readonly serviceUrl: string;
  private readonly internalApiKey: string;

  constructor() {
    this.client = new CloudTasksClient();

    const project = process.env.GCS_PROJECT_ID ?? '';
    const location = process.env.GCP_LOCATION ?? 'us-central1';
    const queue = process.env.CLOUD_TASKS_QUEUE ?? 'capsule-video-pipeline';
    this.serviceUrl = process.env.CLOUD_RUN_SERVICE_URL ?? '';
    this.internalApiKey = process.env.INTERNAL_API_KEY ?? '';

    this.queuePath = this.client.queuePath(project, location, queue);
  }

  async dispatchVideoGeneration(payload: VideoTaskPayload): Promise<void> {
    const url = `${this.serviceUrl}/api/v1/internal/capsules/${payload.capsuleId}/process-video`;
    const body = JSON.stringify({ voiceId: payload.voiceId });

    this.logger.log(
      `Dispatching Cloud Task for capsule ${payload.capsuleId} → ${url}`,
    );

    try {
      await this.client.createTask({
        parent: this.queuePath,
        task: {
          httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: {
              'Content-Type': 'application/json',
              'x-internal-api-key': this.internalApiKey,
            },
            body: Buffer.from(body).toString('base64'),
          },
        },
      });

      this.logger.log(`Cloud Task dispatched for capsule ${payload.capsuleId}`);
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to dispatch Cloud Task: ${message}`);
      throw new Error(`Failed to dispatch video generation task: ${message}`);
    }
  }
}
