import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

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
 * After successful validation, req.user contains the ValidatedUser object
 * with auth0Id, email, and permissions.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Determines if the request can activate the route.
   * Overrides the default canActivate to add custom error handling.
   *
   * @param context - Execution context
   * @returns Promise or Observable indicating if activation is allowed
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
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
      }>();
      const { method, url } = request;

      // Log unauthorized access attempt (can be expanded to audit service)
      const infoMessage = info?.message || undefined;
      const errorMessage = err?.message || undefined;
      console.warn(
        `[JwtAuthGuard] Unauthorized access attempt: ${method} ${url}`,
        { info: infoMessage, error: errorMessage },
      );

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
        errorMessage || infoMessage || 'Unauthorized access',
      );
    }

    // User is valid, attach to request
    return user;
  }
}
