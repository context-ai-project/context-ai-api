import { Injectable, Logger } from '@nestjs/common';
import { extractErrorMessage } from '@shared/utils';
import type {
  IAudioGenerator,
  AudioGenerationOptions,
  AudioResult,
  VoiceInfo,
} from '../../domain/services/audio-generator.interface';

// ElevenLabs API constants (OWASP: Magic Numbers)
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;
const MAX_CHUNK_CHARS = 4500;
const AUDIO_CONTENT_TYPE = 'audio/mpeg';
const HTTP_OK = 200;

// MP3 duration calculation from buffer size
// ElevenLabs produces 128 kbps CBR MP3s → 128,000 bits/s → 16,000 bytes/s
const MP3_BYTES_PER_SECOND = 16_000;

/** Minimal shape of ElevenLabs voice from the /voices endpoint */
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

/**
 * ElevenLabsAudioService
 *
 * Implements IAudioGenerator using the ElevenLabs REST API.
 * Uses native fetch (no SDK) as specified in the implementation plan.
 *
 * Features:
 * - Text fragmentation for scripts longer than MAX_CHUNK_CHARS
 * - Multi-lingual v2 model support
 * - Voice listing from /v1/voices endpoint
 * - Configurable voice settings (stability, similarity_boost)
 *
 * Environment variables:
 * - ELEVENLABS_API_KEY: ElevenLabs API key
 */
@Injectable()
export class ElevenLabsAudioService implements IAudioGenerator {
  private readonly logger = new Logger(ElevenLabsAudioService.name);
  private readonly apiKey: string;

  constructor() {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error(
        'ELEVENLABS_API_KEY environment variable is required for audio generation',
      );
    }
    this.apiKey = key;
  }

  async generateAudio(
    text: string,
    options: AudioGenerationOptions,
  ): Promise<AudioResult> {
    if (!text?.trim()) {
      throw new Error('Text is required for audio generation');
    }
    if (!options.voiceId) {
      throw new Error('voiceId is required for audio generation');
    }

    const chunks = this.splitIntoChunks(text);
    this.logger.log(
      `Generating audio for ${chunks.length} chunk(s) with voice ${options.voiceId}`,
    );

    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buffer = await this.generateChunk(chunk, options);
      audioBuffers.push(buffer);
    }

    const audioBuffer = Buffer.concat(audioBuffers);
    const durationSeconds = this.calculateDuration(audioBuffer);

    this.logger.log(
      `Audio generated: ${audioBuffer.length} bytes, ~${durationSeconds}s`,
    );

    return {
      audioBuffer,
      durationSeconds,
      contentType: AUDIO_CONTENT_TYPE,
    };
  }

  async getAvailableVoices(): Promise<VoiceInfo[]> {
    const url = `${ELEVENLABS_BASE_URL}/voices`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
          Accept: 'application/json',
        },
      });

      if (response.status !== HTTP_OK) {
        const body = await response.text();
        throw new Error(
          `ElevenLabs /voices returned HTTP ${response.status}: ${body}`,
        );
      }

      const data = (await response.json()) as { voices: ElevenLabsVoice[] };

      return data.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        description: v.description,
        labels: v.labels,
        previewUrl: v.preview_url,
      }));
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to fetch voices: ${message}`);
      throw new Error(`Failed to fetch ElevenLabs voices: ${message}`);
    }
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Calls the ElevenLabs TTS endpoint for a single text chunk.
   */
  private async generateChunk(
    text: string,
    options: AudioGenerationOptions,
  ): Promise<Buffer> {
    const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${options.voiceId}`;

    const body = JSON.stringify({
      text,
      model_id: options.model ?? DEFAULT_MODEL,
      voice_settings: {
        stability: options.stability ?? DEFAULT_STABILITY,
        similarity_boost: options.similarityBoost ?? DEFAULT_SIMILARITY_BOOST,
      },
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: AUDIO_CONTENT_TYPE,
        },
        body,
      });

      if (response.status !== HTTP_OK) {
        const errBody = await response.text();
        throw new Error(
          `ElevenLabs TTS returned HTTP ${response.status}: ${errBody}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Failed to generate audio chunk: ${message}`);
      throw new Error(`ElevenLabs audio generation failed: ${message}`);
    }
  }

  /**
   * Splits a long text into chunks at natural pause points.
   * Chunks do not exceed MAX_CHUNK_CHARS characters.
   * Splits prefer sentence boundaries (., !, ?).
   */
  private splitIntoChunks(text: string): string[] {
    if (text.length <= MAX_CHUNK_CHARS) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > MAX_CHUNK_CHARS) {
      const window = remaining.substring(0, MAX_CHUNK_CHARS);
      // Find the last sentence-ending punctuation in the window
      const lastPause = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('! '),
        window.lastIndexOf('? '),
        window.lastIndexOf('.\n'),
      );

      const cutAt = lastPause > 0 ? lastPause + 1 : MAX_CHUNK_CHARS;
      chunks.push(remaining.substring(0, cutAt).trim());
      remaining = remaining.substring(cutAt).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }

  /**
   * Calculates audio duration from the actual MP3 buffer size.
   * ElevenLabs produces 128 kbps CBR MP3s (16,000 bytes/second).
   * This is exact for CBR and accurate within ~1s for VBR.
   */
  private calculateDuration(buffer: Buffer): number {
    return Math.round(buffer.length / MP3_BYTES_PER_SECOND);
  }
}
