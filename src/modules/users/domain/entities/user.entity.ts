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

export interface UserProps {
  id: string;
  auth0UserId: string;
  email: string;
  name: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date | null;
}

export class User {
  public readonly id: string;
  public readonly auth0UserId: string;
  public readonly email: string;
  public readonly name: string;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly lastLoginAt: Date | null;

  constructor(props: UserProps) {
    this.id = props.id;
    this.auth0UserId = props.auth0UserId;
    this.email = props.email;
    this.name = props.name;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.lastLoginAt = props.lastLoginAt ?? null;
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): User {
    return new User({
      ...this,
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    });
  }

  /**
   * Deactivate user (soft delete)
   */
  deactivate(): User {
    return new User({
      ...this,
      isActive: false,
      updatedAt: new Date(),
    });
  }
}
