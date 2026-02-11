import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenRevocationService } from '../application/services/token-revocation.service';
import { ValidatedUser } from '../types/jwt-payload.type';

/**
 * PassportError
 * Represents errors from Passport.js
 */
interface PassportError extends Error {
  message: string;
  name: string;
}

/**
 * PassportInfo
 * Represents additional information from Passport.js
 */
interface PassportInfo {
  message?: string;
  name?: string;
}

/**
 * JwtAuthGuard
 *
 * Guards routes by validating JWT tokens using the JwtStrategy.
 * Extends Passport's AuthGuard to leverage the 'jwt' strategy.
 *
 * Features:
 * - Validates JWT tokens from Authorization header
 * - Checks if token has been revoked (for immediate logout)
 * - Respects @Public() decorator (skips authentication)
 * - Provides detailed error messages for different failure scenarios
 * - Logs authentication failures for security audit
 *
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * @Controller('protected')
 * export class ProtectedController { ... }
 *
 * Or on individual routes:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@Req() req) { return req.user; }
 *
 * Public routes (skip authentication):
 * @Public()
 * @Get('health')
 * getHealth() { return { status: 'ok' }; }
 *
 * After successful validation, req.user contains the ValidatedUser object
 * with auth0Id, email, permissions, userId, and jti.
 *
 * Phase 6 Implementation:
 * - Issue 6.4: JWT Authentication Guard ✅
 * - Issue 6.13: Token Revocation ✅
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {
    super();
  }

  /**
   * Determines if the request can activate the route.
   * Overrides the default canActivate to check for @Public() decorator.
   *
   * @param context - Execution context
   * @returns Promise or Observable indicating if activation is allowed
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Skip authentication for public routes
      return true;
    }

    // Call parent class's canActivate (which uses JwtStrategy)
    return super.canActivate(context);
  }

  /**
   * Handles authentication errors and unauthorized requests.
   * Provides detailed error messages for different failure scenarios.
   *
   * @param err - Error object (if any)
   * @param user - User object (if validated)
   * @param info - Additional info from Passport (e.g., token expiry)
   * @param context - Execution context
   * @returns User object if validation succeeds
   * @throws UnauthorizedException with detailed error message
   */
  handleRequest<TUser = unknown>(
    err: PassportError | null,
    user: TUser | null,
    info: PassportInfo | undefined,
    context: ExecutionContext,
  ): TUser {
    // If there's an error or no user, deny access
    if (err !== null || !user) {
      // Extract request for logging (optional - can be used for audit logs)
      const request = context.switchToHttp().getRequest<{
        method: string;
        url: string;
        ip?: string;
      }>();
      const { method, url } = request;

      // Extract path without query parameters (may contain sensitive data)
      const path = url.split('?')[0];

      // Log unauthorized access attempt with structured logging
      // Do NOT log: tokens, passwords, full URLs with query params
      this.logger.warn('Authentication failed', {
        method,
        path, // Only path, no query params
        ip: request.ip, // For rate limiting/security monitoring
        reason: info?.name || 'unknown',
        errorType: err?.name || info?.message || 'unauthorized',
        timestamp: new Date().toISOString(),
      });

      // Provide detailed error messages based on the failure reason
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }

      if (info?.message === 'No auth token') {
        throw new UnauthorizedException(
          'Authentication token is required. Please provide a valid JWT in the Authorization header',
        );
      }

      // Generic unauthorized error
      throw new UnauthorizedException(
        err?.message || info?.message || 'Unauthorized access',
      );
    }

    // Check if token has been revoked
    // The JwtStrategy always returns a ValidatedUser, but the generic TUser
    // doesn't overlap with ValidatedUser at compile time, requiring unknown cast
    const validatedUser = user as unknown as ValidatedUser;
    if (validatedUser.jti) {
      const isRevoked = this.tokenRevocationService.isTokenRevoked(
        validatedUser.jti,
      );

      if (isRevoked) {
        this.logger.warn('Revoked token attempted to access resource', {
          jti: validatedUser.jti.substring(0, 8) + '...',
          userId: validatedUser.userId?.substring(0, 8) + '...',
          timestamp: new Date().toISOString(),
        });

        throw new UnauthorizedException(
          'Token has been revoked. Please login again',
        );
      }
    }

    // User is valid and token is not revoked, attach to request
    return user;
  }
}
