import { Injectable, Logger } from '@nestjs/common';
import { extractErrorMessage } from '@shared/utils';
import type {
  IVideoRenderer,
  VideoTimelineRequest,
  RenderStatusResponse,
} from '../../domain/services/video-renderer.interface';

const FALLBACK_SCENE_DURATION_SECONDS = 8;
const ROUNDING_FACTOR = 100;
const SHOTSTACK_STAGE_URL = 'https://api.shotstack.io/stage';
const SHOTSTACK_V1_URL = 'https://api.shotstack.io/v1';

const IMAGE_EFFECTS: string[] = [
  'zoomIn',
  'slideRight',
  'zoomOut',
  'slideLeft',
];

interface ShotstackClip {
  asset: Record<string, unknown>;
  start: number;
  length: number;
  effect?: string;
  position?: string;
  offset?: { y: number };
  transition?: { in?: string; out?: string };
}

@Injectable()
export class ShotstackRendererService implements IVideoRenderer {
  private readonly logger = new Logger(ShotstackRendererService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.SHOTSTACK_API_KEY;
    if (!apiKey) {
      throw new Error(
        'SHOTSTACK_API_KEY environment variable is required for video rendering',
      );
    }

    const env = process.env.SHOTSTACK_ENVIRONMENT ?? 'stage';
    this.apiKey = apiKey;
    this.baseUrl = env === 'v1' ? SHOTSTACK_V1_URL : SHOTSTACK_STAGE_URL;
  }

  async renderVideo(timeline: VideoTimelineRequest): Promise<string> {
    this.logger.log(
      `Submitting Shotstack render: ${timeline.scenes.length} scenes`,
    );

    const edit = this.buildTimeline(timeline);

    const res = await fetch(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(edit),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Shotstack POST /render failed (${res.status}): ${body}`,
      );
      throw new Error(
        `Shotstack render submission failed (${res.status}): ${body}`,
      );
    }

    const json = (await res.json()) as {
      response?: { id?: string };
    };
    const renderId = json.response?.id ?? '';

    if (!renderId) {
      this.logger.error('Shotstack returned no render ID', json);
      throw new Error('Shotstack returned no render ID');
    }

    this.logger.log(`Shotstack render submitted: ${renderId}`);
    return renderId;
  }

  async getRenderStatus(renderId: string): Promise<RenderStatusResponse> {
    try {
      const res = await fetch(
        `${this.baseUrl}/render/${encodeURIComponent(renderId)}`,
        { headers: { 'x-api-key': this.apiKey } },
      );

      if (!res.ok) {
        throw new Error(
          `Shotstack API responded ${res.status} ${res.statusText}`,
        );
      }

      const json = (await res.json()) as {
        response?: { status?: string; url?: string; error?: string };
      };
      const data = json.response;

      return {
        status: (data?.status as RenderStatusResponse['status']) ?? 'failed',
        url: data?.url,
        errorMessage: data?.error,
      };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to get render status: ${message}`);
      return { status: 'failed', errorMessage: message };
    }
  }

  // ── Build a plain JSON payload for the Shotstack REST API ──

  private buildTimeline(
    request: VideoTimelineRequest,
  ): Record<string, unknown> {
    const sceneCount = request.scenes.length;
    const sceneDuration =
      request.audioDurationSeconds > 0 && sceneCount > 0
        ? request.audioDurationSeconds / sceneCount
        : FALLBACK_SCENE_DURATION_SECONDS;

    const round2 = (n: number): number =>
      Math.round(n * ROUNDING_FACTOR) / ROUNDING_FACTOR;

    const audioDur = request.audioDurationSeconds;
    this.logger.log(
      `Scene duration: ${String(round2(sceneDuration))}s ` +
        `(audio ${String(round2(audioDur))}s / ${String(sceneCount)} scenes)`,
    );

    const imageClips: ShotstackClip[] = [];
    const textClips: ShotstackClip[] = [];

    request.scenes.forEach((scene, index) => {
      const start = round2(index * sceneDuration);
      const length = round2(sceneDuration);

      const imageTransition: { in?: string; out?: string } = { in: 'fade' };
      if (index < request.scenes.length - 1) {
        imageTransition.out = 'fade';
      }

      imageClips.push({
        asset: { type: 'image', src: scene.imageUrl },
        start,
        length,
        effect: IMAGE_EFFECTS[index % IMAGE_EFFECTS.length],
        transition: imageTransition,
      });

      if (scene.titleOverlay) {
        const html =
          `<div style="font-family:'Montserrat',Helvetica,sans-serif;` +
          `font-size:32px;font-weight:600;color:#FFFFFF;` +
          `background:rgba(0,0,0,0.55);padding:12px 28px;` +
          `border-radius:8px;text-align:center;">` +
          `${this.escapeHtml(scene.titleOverlay)}</div>`;

        textClips.push({
          asset: { type: 'html', html, width: 600, height: 80 },
          start,
          length,
          position: 'bottom',
          offset: { y: 0.05 },
          transition: { in: 'fade', out: 'fade' },
        });
      }
    });

    return {
      timeline: {
        tracks: [{ clips: textClips }, { clips: imageClips }],
        soundtrack: {
          src: request.audioUrl,
          effect: 'fadeOut',
        },
      },
      output: {
        format: 'mp4',
        resolution: request.resolution === '720' ? 'sd' : 'hd',
      },
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
