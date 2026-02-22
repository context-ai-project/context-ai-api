/**
 * Invitation Domain Events
 *
 * Events emitted during the invitation lifecycle.
 * Consumed by NotificationListener to create in-app notifications.
 */

export class InvitationCreatedEvent {
  constructor(
    public readonly invitationId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly role: string,
    public readonly sectorIds: string[],
    public readonly invitedBy: string,
    public readonly createdAt: Date,
  ) {}
}

export class InvitationAcceptedEvent {
  constructor(
    public readonly invitationId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly userId: string,
    public readonly acceptedAt: Date,
  ) {}
}
