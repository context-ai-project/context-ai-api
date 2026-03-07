/**
 * Types of multimedia capsules supported by the platform.
 * - VIDEO: Video-only capsule (Block B)
 * - AUDIO: Audio-only capsule — narrated script via TTS (Block A)
 * - BOTH: Combined audio and video capsule (Block B)
 */
export enum CapsuleType {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  BOTH = 'BOTH',
}
