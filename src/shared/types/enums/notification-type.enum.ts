/**
 * Notification Type Enum
 *
 * Defines all possible notification types in the system.
 * Designed for extensibility in v2 (document events, etc.)
 *
 * v1.3 — Invitations & Users
 * v2   — Documents (prepared for extension)
 */
export enum NotificationType {
  // v1.3 — Invitations
  INVITATION_CREATED = 'invitation.created',
  INVITATION_ACCEPTED = 'invitation.accepted',
  INVITATION_EXPIRED = 'invitation.expired',

  // v1.3 — Users
  USER_ACTIVATED = 'user.activated',

  // v2 — Documents (prepared for extension)
  DOCUMENT_PROCESSED = 'document.processed',
  DOCUMENT_FAILED = 'document.failed',
}
