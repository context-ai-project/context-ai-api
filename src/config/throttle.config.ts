import { registerAs } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Throttle (Rate Limiting) Configuration
 *
 * Defines rate limiting policies for the API to prevent abuse and DDoS attacks.
 *
 * Three tiers of rate limiting:
 * 1. **short**: For burst protection (10 req/sec)
 * 2. **medium**: For normal operations (100 req/min)
 * 3. **long**: For hourly limits (1000 req/hour)
 *
 * Environment Variables:
 * - THROTTLE_TTL_SHORT (default: 1000ms = 1 second)
 * - THROTTLE_LIMIT_SHORT (default: 10 requests)
 * - THROTTLE_TTL_MEDIUM (default: 60000ms = 1 minute)
 * - THROTTLE_LIMIT_MEDIUM (default: 100 requests)
 * - THROTTLE_TTL_LONG (default: 3600000ms = 1 hour)
 * - THROTTLE_LIMIT_LONG (default: 1000 requests)
 *
 * Usage in Controllers:
 * ```typescript
 * @Controller('chat')
 * @UseGuards(JwtAuthGuard)
 * export class ChatController {
 *   @Post('query')
 *   @Throttle({ medium: { limit: 30, ttl: 60000 } }) // Override: 30 req/min
 *   async query(@Body() dto: QueryDto) {
 *     // ...
 *   }
 * }
 * ```
 *
 * Phase 6 Implementation:
 * - Issue 6.14: Rate Limiting ✅
 */
export default registerAs(
  'throttle',
  (): ThrottlerModuleOptions => ({
    throttlers: [
      {
        name: 'short',
        ttl: parseInt(process.env.THROTTLE_TTL_SHORT || '1000', 10), // 1 second
        limit: parseInt(process.env.THROTTLE_LIMIT_SHORT || '10', 10), // 10 requests
      },
      {
        name: 'medium',
        ttl: parseInt(process.env.THROTTLE_TTL_MEDIUM || '60000', 10), // 1 minute
        limit: parseInt(process.env.THROTTLE_LIMIT_MEDIUM || '100', 10), // 100 requests
      },
      {
        name: 'long',
        ttl: parseInt(process.env.THROTTLE_TTL_LONG || '3600000', 10), // 1 hour
        limit: parseInt(process.env.THROTTLE_LIMIT_LONG || '1000', 10), // 1000 requests
      },
    ],
    errorMessage: 'Too many requests. Please try again later.',
  }),
);
