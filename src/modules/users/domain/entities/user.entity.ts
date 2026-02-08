/**
 * User Domain Entity
 *
 * Represents a user in the system, synchronized from Auth0
 *
 * Business Rules:
 * - Each user has a unique Auth0 sub (auth0UserId)
 * - Email must be unique
 * - Users can be soft-deleted (isActive flag)
 * - Last login timestamp is tracked
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly auth0UserId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly lastLoginAt: Date | null = null,
  ) {}

  /**
   * Update last login timestamp
   */
  updateLastLogin(): User {
    return new User(
      this.id,
      this.auth0UserId,
      this.email,
      this.name,
      this.isActive,
      this.createdAt,
      new Date(),
      new Date(),
    );
  }

  /**
   * Deactivate user (soft delete)
   */
  deactivate(): User {
    return new User(
      this.id,
      this.auth0UserId,
      this.email,
      this.name,
      false,
      this.createdAt,
      new Date(),
      this.lastLoginAt,
    );
  }
}
