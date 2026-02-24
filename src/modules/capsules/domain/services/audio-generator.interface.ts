/**
 * Audio Generator Interface (IAudioGenerator)
 *
 * Defines the contract for text-to-speech audio synthesis.
 * Follows Dependency Inversion Principle — domain defines the port,
 * infrastructure provides the adapter (ElevenLabs, etc.).
 */

/** Options for audio generation */
export interface AudioGenerationOptions {
  /** Voice ID to use for synthesis */
  voiceId: string;
  /** TTS model identifier (e.g. eleven_multilingual_v2) */
  model?: string;
  /** Stability setting 0–1 (default 0.5) */
  stability?: number;
  /** Similarity boost 0–1 (default 0.75) */
  similarityBoost?: number;
}

/** Result of a successful audio generation */
export interface AudioResult {
  /** Raw audio bytes (MP3) */
  audioBuffer: Buffer;
  /** Duration of the generated audio in seconds */
  durationSeconds: number;
  /** MIME type of the audio file */
  contentType: string;
}

/** Info about an available TTS voice */
export interface VoiceInfo {
  /** Unique voice identifier */
  id: string;
  /** Human-readable voice name */
  name: string;
  /** Optional description of the voice */
  description?: string;
  /** Labels/tags associated with the voice */
  labels?: Record<string, string>;
  /** Preview URL (if available) */
  previewUrl?: string;
}

/**
 * IAudioGenerator
 *
 * Port for audio synthesis services.
 * Implementations: ElevenLabsAudioService.
 */
/** Callback invoked after each TTS chunk completes, reporting real progress */
export type ChunkProgressCallback = (
  completed: number,
  total: number,
) => void | Promise<void>;

export interface IAudioGenerator {
  /**
   * Generates audio from a text script.
   * Long texts are automatically fragmented and concatenated.
   *
   * @param text - Narrative script to synthesize
   * @param options - Voice and model options
   * @param onChunkProgress - Optional progress callback (completed chunks / total)
   * @returns Audio buffer with duration metadata
   */
  generateAudio(
    text: string,
    options: AudioGenerationOptions,
    onChunkProgress?: ChunkProgressCallback,
  ): Promise<AudioResult>;

  /**
   * Returns the list of available voices for the provider.
   *
   * @returns Array of voice descriptors
   */
  getAvailableVoices(): Promise<VoiceInfo[]>;
}
