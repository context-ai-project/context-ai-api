/**
 * Discrete steps of the capsule generation pipeline.
 * Used in generation logs to track progress per stage.
 *
 * Block A uses: SCRIPT → AUDIO
 * Block B adds: VIDEO → POSTPROCESS
 */
export enum CapsuleGenerationStep {
  SCRIPT = 'SCRIPT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  POSTPROCESS = 'POSTPROCESS',
}
