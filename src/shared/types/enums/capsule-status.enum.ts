/**
 * Lifecycle statuses for a multimedia capsule.
 *
 * Allowed transitions:
 *   DRAFT → GENERATING → COMPLETED → ACTIVE
 *   GENERATING → FAILED  (retry resets to DRAFT)
 *   ACTIVE | COMPLETED → ARCHIVED
 */
export enum CapsuleStatus {
  DRAFT = 'DRAFT',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}
