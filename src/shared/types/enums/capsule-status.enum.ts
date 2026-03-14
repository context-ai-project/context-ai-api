/**
 * Lifecycle statuses for a multimedia capsule.
 *
 * Allowed transitions:
 *   DRAFT → GENERATING_ASSETS → RENDERING → COMPLETED → ACTIVE
 *   GENERATING_ASSETS → FAILED  (retry resets to DRAFT)
 *   RENDERING → FAILED
 *   ACTIVE | COMPLETED → ARCHIVED
 *
 * Audio-only capsules skip RENDERING and go GENERATING_ASSETS → COMPLETED.
 */
export enum CapsuleStatus {
  DRAFT = 'DRAFT',
  GENERATING_ASSETS = 'GENERATING_ASSETS',
  RENDERING = 'RENDERING',
  COMPLETED = 'COMPLETED',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}
