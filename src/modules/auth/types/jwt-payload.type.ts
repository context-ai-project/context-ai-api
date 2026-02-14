/**
 * JWT Payload Interface
 *
 * Represents the decoded JWT token payload from Auth0.
 * These are the claims we expect to receive in the token.
 *
 * Standard JWT Claims:
 * - sub: Subject (Auth0 user ID, e.g., "auth0|123456")
 * - iss: Issuer (Auth0 domain)
 * - aud: Audience (our API identifier)
 * - exp: Expiration time (Unix timestamp)
 * - iat: Issued at time (Unix timestamp)
 *
 * Custom Claims:
 * - email: User's email address
 * - permissions: Array of permission strings (if RBAC enabled in Auth0)
 */
export interface JwtPayload {
  /**
   * Subject - Auth0 user ID
   * Format: "auth0|123456" or "google-oauth2|123456"
   */
  sub: string;

  /**
   * Issuer - Auth0 domain
   * Example: "https://your-tenant.auth0.com/"
   */
  iss: string;

  /**
   * Audience - API identifier
   * Example: "https://api.contextai.com"
   */
  aud: string | string[];

  /**
   * Expiration time (Unix timestamp)
   */
  exp: number;

  /**
   * Issued at time (Unix timestamp)
   */
  iat: number;

  /**
   * JWT ID - Unique identifier for this token (optional)
   * Used for token revocation and tracking
   * Example: "abc123def456"
   */
  jti?: string;

  /**
   * User's email address (optional)
   */
  email?: string;

  /**
   * User's name (optional)
   */
  name?: string;

  /**
   * User's profile picture URL (optional)
   */
  picture?: string;

  /**
   * Permissions granted to this token (optional)
   * Format: resource:action (e.g., "knowledge:read", "knowledge:write")
   * Example: ["knowledge:read", "knowledge:write", "chat:read"]
   */
  permissions?: string[];

  /**
   * Scope string (OAuth2 scopes)
   * Example: "openid profile email"
   */
  scope?: string;

  /**
   * Email verification status (optional)
   */
  email_verified?: boolean;

  /**
   * Additional custom claims from Auth0
   */
  [key: string]: unknown;
}

/**
 * Validated User Interface
 *
 * Represents the authenticated user after JWT validation.
 * This is what gets attached to the request object.
 */
export interface ValidatedUser {
  /**
   * Auth0 user ID (from 'sub' claim)
   * Example: "auth0|123456"
   */
  auth0Id: string;

  /**
   * User's email address
   */
  email?: string;

  /**
   * User's name
   */
  name?: string;

  /**
   * User's profile picture URL
   */
  picture?: string;

  /**
   * Permissions granted to this user
   */
  permissions: string[];

  /**
   * Internal user ID (UUID from our database)
   * Populated after user sync with our database
   */
  userId: string;

  /**
   * JWT ID - Unique identifier for this token (optional)
   * Used for token revocation
   */
  jti?: string;
}
