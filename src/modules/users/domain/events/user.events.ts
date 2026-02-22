/**
 * User Domain Events
 *
 * Events emitted during user lifecycle changes.
 * Consumed by NotificationListener to create in-app notifications for admins.
 */

export class UserActivatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly auth0UserId: string,
    public readonly activatedAt: Date,
  ) {}
}
