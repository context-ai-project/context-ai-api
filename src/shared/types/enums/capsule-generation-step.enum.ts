/**
 * Discrete steps of the capsule generation pipeline.
 * Used in generation logs to track progress per stage.
 *
 * Block A (audio): SCRIPT → AUDIO
 * Block B (video): SCRIPT → IMAGES → AUDIO → RENDERING
 */
export enum CapsuleGenerationStep {
  SCRIPT = 'SCRIPT',
  AUDIO = 'AUDIO',
  IMAGES = 'IMAGES',
  RENDERING = 'RENDERING',
}
