import type { VideoScene } from '../value-objects/video-scene.vo';

/**
 * Input for assembling a video from scenes, audio, and image URLs.
 */
export interface VideoTimelineRequest {
  scenes: Array<VideoScene & { imageUrl: string }>;
  audioUrl: string;
  audioDurationSeconds: number;
  resolution?: '1080' | '720';
}

export type RenderStatus =
  | 'queued'
  | 'fetching'
  | 'rendering'
  | 'saving'
  | 'done'
  | 'failed';

export interface RenderStatusResponse {
  status: RenderStatus;
  url?: string;
  errorMessage?: string;
}

/**
 * Port for cloud video rendering (Shotstack).
 *
 * Accepts a timeline of image URLs + audio URL + text overlays,
 * submits a render job, and polls until the video is ready.
 */
export interface IVideoRenderer {
  renderVideo(timeline: VideoTimelineRequest): Promise<string>;
  getRenderStatus(renderId: string): Promise<RenderStatusResponse>;
}
