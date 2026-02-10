import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator: Public
 *
 * Marks a route handler as publicly accessible (no authentication required).
 * This decorator tells JwtAuthGuard to skip authentication for this route.
 *
 * @example
 * // Public health check endpoint
 * `@Public()`
 * `@Get('health')`
 * getHealth() { return { status: 'ok' }; }
 *
 * @example
 * // Public documentation endpoint
 * `@Public()`
 * `@Get('docs')`
 * getDocs() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
