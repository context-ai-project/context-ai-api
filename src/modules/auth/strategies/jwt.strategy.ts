import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  ExtractJwt,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthService } from '../auth.service';
import { JwtPayload, ValidatedUser } from '../types/jwt-payload.type';
import { UserService } from '../../users/application/services/user.service';

/**
 * JWT Strategy
 *
 * Validates JWT tokens from Auth0 using JWKS (JSON Web Key Set).
 * This strategy:
 * 1. Extracts JWT from Authorization header
 * 2. Fetches public keys from Auth0 JWKS endpoint
 * 3. Validates token signature using public key
 * 4. Validates audience and issuer
 * 5. Returns validated user information
 *
 * Security Features:
 * - JWKS caching: Reduces Auth0 API calls
 * - Rate limiting: Prevents JWKS endpoint abuse
 * - Signature validation: Ensures token authenticity
 * - Audience validation: Prevents token reuse across APIs
 * - Issuer validation: Ensures token is from correct Auth0 tenant
 *
 * @see https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens
 * @see https://datatracker.ietf.org/doc/html/rfc7517 (JWKS Specification)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {
    const auth0Audience = authService.getAuth0Audience();
    const auth0Issuer = authService.getAuth0Issuer();

    const options: StrategyOptionsWithoutRequest = {
      // JWKS Configuration
      secretOrKeyProvider: passportJwtSecret({
        cache: true, // Cache keys to reduce Auth0 API calls
        rateLimit: true, // Enable rate limiting
        jwksRequestsPerMinute: 5, // Max 5 JWKS requests per minute
        jwksUri: `${auth0Issuer}.well-known/jwks.json`,
      }),

      // JWT Extraction
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Validation
      audience: auth0Audience,
      issuer: auth0Issuer,
      algorithms: ['RS256'], // Auth0 uses RS256 (RSA Signature with SHA-256)
    };

    super(options);
  }

  /**
   * Validate JWT Payload
   *
   * Called after JWT signature is validated.
   * Extracts user information from token payload and syncs with database.
   *
   * Auth0 access tokens may or may not include profile claims (email, name)
   * depending on the API configuration and Auth0 Actions. This method handles both:
   * 1. Token WITH email → sync user (create/update + update last login)
   * 2. Token WITHOUT email → look up existing user by auth0 ID from database
   *    (user should have been synced via /users/sync during login)
   *
   * @param payload - Decoded JWT payload
   * @returns Validated user information with internal user ID
   * @throws UnauthorizedException if payload is invalid or user not found
   */
  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    // Validate required fields
    if (!payload.sub) {
      throw new UnauthorizedException(
        'Invalid token: missing subject (sub) claim',
      );
    }

    // Log authentication attempt (structured logging, no sensitive data)
    const provider = payload.sub.split('|')[0]; // Extract provider (auth0, google, github)
    this.logger.log('JWT validation initiated', {
      provider,
      hasEmail: !!payload.email,
      hasName: !!payload.name,
      timestamp: new Date().toISOString(),
    });

    // Resolve user - from token claims or from database
    let userId: string;
    let userEmail: string;
    let userName: string | undefined;

    if (payload.email) {
      // Token has profile claims - sync user (create or update + update last login)
      const user = await this.userService.syncUser({
        auth0UserId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
      });
      userId = user.id;
      userEmail = payload.email;
      userName = payload.name;
    } else {
      // Access token without profile claims (standard Auth0 behavior)
      // User should have been synced during login via /users/sync endpoint
      const existingUser = await this.userService.findByAuth0UserId(
        payload.sub,
      );

      if (!existingUser) {
        this.logger.warn('User not found in database for auth0 ID', {
          auth0Id: `${payload.sub.substring(0, 15)}...`,
          timestamp: new Date().toISOString(),
        });
        throw new UnauthorizedException(
          'User not found. Please login again to sync your profile.',
        );
      }

      userId = existingUser.id;
      userEmail = existingUser.email;
      userName = existingUser.name;
    }

    // Log successful validation (mask sensitive data)
    this.logger.log('User authenticated', {
      userId: `${userId.substring(0, 8)}...`, // Partial UUID for privacy
      provider,
      action: 'login',
      timestamp: new Date().toISOString(),
    });

    // Extract permissions (if RBAC is enabled in Auth0)
    const permissions = this.extractPermissions(payload);

    // Build validated user object with internal user ID
    const validatedUser: ValidatedUser = {
      userId, // Internal database user ID
      auth0Id: payload.sub,
      email: userEmail,
      name: userName,
      picture: payload.picture,
      permissions,
      jti: payload.jti, // JWT ID for token revocation
    };

    return validatedUser;
  }

  /**
   * Extract Permissions from JWT Payload
   *
   * Auth0 can include permissions in two ways:
   * 1. `permissions` array (when RBAC is enabled)
   * 2. `scope` string (OAuth2 scopes)
   *
   * Permissions are normalized to resource:action format (e.g., "knowledge:read")
   * to match our RBAC system. Auth0 may emit action:resource (e.g., "read:knowledge"),
   * so we detect and flip them when needed.
   *
   * @param payload - JWT payload
   * @returns Array of permission strings in resource:action format
   */
  private extractPermissions(payload: JwtPayload): string[] {
    let permissions: string[] = [];

    // Option 1: RBAC permissions array
    if (payload.permissions && Array.isArray(payload.permissions)) {
      permissions = payload.permissions;
    }
    // Option 2: OAuth2 scopes
    else if (payload.scope && typeof payload.scope === 'string') {
      permissions = payload.scope.split(' ');
    }

    // Normalize to resource:action format
    return permissions.map((perm) => this.normalizePermission(perm));
  }

  /**
   * Normalize a permission string to resource:action format.
   *
   * Known actions: read, write, create, update, delete, manage, list, upload
   * If the first segment is a known action (e.g., "read:knowledge"),
   * flip to resource:action ("knowledge:read").
   *
   * @param permission - Permission string (either format)
   * @returns Permission in resource:action format
   */
  private normalizePermission(permission: string): string {
    const parts = permission.split(':');
    if (parts.length !== 2) {
      return permission; // Not a colon-separated pair, return as-is
    }

    const knownActions = new Set([
      'read',
      'write',
      'create',
      'update',
      'delete',
      'manage',
      'list',
      'upload',
    ]);

    const [first, second] = parts;
    // If the first part is a known action, it's action:resource → flip
    if (knownActions.has(first) && !knownActions.has(second)) {
      return `${second}:${first}`;
    }

    // Already resource:action or ambiguous → return as-is
    return permission;
  }
}
