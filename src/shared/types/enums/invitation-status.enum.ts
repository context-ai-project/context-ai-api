/**
 * Invitation Status Enum
 *
 * Tracks the lifecycle of a user invitation:
 * - PENDING: Created, email sent, awaiting user action
 * - ACCEPTED: User set password and logged in
 * - EXPIRED: Past expiration date (7 days)
 * - REVOKED: Admin cancelled the invitation
 */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}
