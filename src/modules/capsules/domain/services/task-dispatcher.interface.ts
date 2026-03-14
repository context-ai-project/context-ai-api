/**
 * Payload for dispatching an async video generation task.
 */
export interface VideoTaskPayload {
  capsuleId: string;
  voiceId: string;
}

/**
 * Port for dispatching async background tasks.
 *
 * Production: Google Cloud Tasks (HTTP webhook)
 * Development: Local in-process execution
 */
export interface ITaskDispatcher {
  dispatchVideoGeneration(payload: VideoTaskPayload): Promise<void>;
}
