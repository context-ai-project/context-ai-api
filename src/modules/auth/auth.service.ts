import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Auth0 configuration object returned by getAuth0Config()
 */
export interface Auth0Config {
  domain: string;
  audience: string;
  issuer: string;
}

/**
 * Auth Service
 *
 * Handles authentication-related business logic.
 * Provides configuration access for JWT strategies.
 *
 * Consolidates Auth0 configuration into a single typed object
 * to avoid repetitive getter patterns (Middle Man refactoring).
 *
 * Related services:
 * - TokenRevocationService: Token validation and revocation
 * - PermissionService: User permissions lookup
 * - AuditService: Auth event logging
 */
@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get complete Auth0 configuration as a typed object.
   * Validates all required fields and throws if any are missing.
   *
   * @returns Auth0Config with domain, audience, and issuer
   * @throws Error if any required configuration is missing
   */
  getAuth0Config(): Auth0Config {
    const domain = this.configService.get<string>('auth.auth0.domain');
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }

    const audience = this.configService.get<string>('auth.auth0.audience');
    if (!audience) {
      throw new Error('AUTH0_AUDIENCE is not configured');
    }

    const issuer = this.configService.get<string>('auth.auth0.issuer');
    if (!issuer) {
      throw new Error('AUTH0_ISSUER is not configured');
    }

    return { domain, audience, issuer };
  }

  /**
   * Validate that all required Auth0 configuration is present
   * @throws Error if any required config is missing
   */
  validateConfiguration(): void {
    this.getAuth0Config();
  }
}
