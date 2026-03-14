/**
 * Types of multimedia capsules supported by the platform.
 * - VIDEO: Video capsule with AI-generated scene images + Shotstack assembly (Block B)
 * - AUDIO: Audio-only capsule — narrated script via TTS (Block A)
 */
export enum CapsuleType {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}
