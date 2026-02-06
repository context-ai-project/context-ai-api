import { registerAs } from '@nestjs/config';

/**
 * Application Configuration
 *
 * Loads and validates application-level configuration from environment variables
 *
 * @returns Configuration object with application settings:
 * - nodeEnv: Current environment (development, production, test)
 * - port: Server port number (default: 3001)
 * - apiPrefix: API route prefix (default: 'api/v1')
 * - frontendUrl: Frontend application URL for CORS (default: 'http://localhost:3000')
 * - allowedOrigins: Array of allowed CORS origins
 */
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
  ).split(','),
}));
