import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  ExtractJwt,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthService } from '../auth.service';
import { JwtPayload, ValidatedUser } from '../types/jwt-payload.type';

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
  constructor(private readonly authService: AuthService) {
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
   * Extracts user information from token payload.
   *
   * @param payload - Decoded JWT payload
   * @returns Validated user information
   * @throws UnauthorizedException if payload is invalid
   */
  validate(payload: JwtPayload): ValidatedUser {
    // Validate required fields
    if (!payload.sub) {
      throw new UnauthorizedException(
        'Invalid token: missing subject (sub) claim',
      );
    }

    // Extract permissions (if RBAC is enabled in Auth0)
    const permissions = this.extractPermissions(payload);

    // Build validated user object
    const validatedUser: ValidatedUser = {
      auth0Id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      permissions,
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
   * @param payload - JWT payload
   * @returns Array of permission strings
   */
  private extractPermissions(payload: JwtPayload): string[] {
    // Option 1: RBAC permissions array
    if (payload.permissions && Array.isArray(payload.permissions)) {
      return payload.permissions;
    }

    // Option 2: OAuth2 scopes
    if (payload.scope && typeof payload.scope === 'string') {
      return payload.scope.split(' ');
    }

    // No permissions found
    return [];
  }
}
