import { registerAs } from '@nestjs/config';

/**
 * Authentication Configuration
 *
 * Loads and validates Auth0 configuration from environment variables
 *
 * @returns Configuration object with Auth0 settings:
 * - auth0.domain: Auth0 domain for authentication
 * - auth0.audience: Auth0 API identifier/audience
 * - auth0.issuer: Auth0 issuer URL for JWT validation
 */
export default registerAs('auth', () => ({
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_ISSUER,
  },
}));
