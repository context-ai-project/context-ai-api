import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Auth Service
 *
 * Handles authentication-related business logic.
 * Provides configuration access for JWT strategies.
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
   * Get Auth0 domain from configuration
   * @returns Auth0 domain
   */
  getAuth0Domain(): string {
    const domain = this.configService.get<string>('auth.auth0.domain');
    if (!domain) {
      throw new Error('AUTH0_DOMAIN is not configured');
    }
    return domain;
  }

  /**
   * Get Auth0 audience (API identifier) from configuration
   * @returns Auth0 audience
   */
  getAuth0Audience(): string {
    const audience = this.configService.get<string>('auth.auth0.audience');
    if (!audience) {
      throw new Error('AUTH0_AUDIENCE is not configured');
    }
    return audience;
  }

  /**
   * Get Auth0 issuer URL from configuration
   * @returns Auth0 issuer URL
   */
  getAuth0Issuer(): string {
    const issuer = this.configService.get<string>('auth.auth0.issuer');
    if (!issuer) {
      throw new Error('AUTH0_ISSUER is not configured');
    }
    return issuer;
  }

  /**
   * Validate that all required Auth0 configuration is present
   * @throws Error if any required config is missing
   */
  validateConfiguration(): void {
    this.getAuth0Domain();
    this.getAuth0Audience();
    this.getAuth0Issuer();
  }
}
