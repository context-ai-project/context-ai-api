import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Header name for the internal API key.
 * Must match the header sent by the frontend server (NextAuth).
 */
const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * InternalApiKeyGuard
 *
 * Guards server-to-server endpoints that are called during bootstrap flows
 * (e.g., user sync during NextAuth login callback) where a JWT is not yet available.
 *
 * This guard validates a shared secret (INTERNAL_API_KEY) sent via the
 * X-Internal-API-Key header. It is used in combination with @Public()
 * to bypass JWT authentication while still ensuring the request is authorized.
 *
 * Security:
 * - Uses constant-time comparison to prevent timing attacks
 * - Logs unauthorized attempts for audit
 * - Requires INTERNAL_API_KEY env var to be configured
 *
 * Usage:
 * @Public()
 * @UseGuards(InternalApiKeyGuard)
 * @Post('sync')
 * syncUser() { ... }
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);
  private readonly configuredKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.configuredKey = this.configService.get<string>('auth.internalApiKey');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      method: string;
      url: string;
      ip?: string;
    }>();

    // Fail if INTERNAL_API_KEY is not configured
    if (!this.configuredKey) {
      this.logger.error(
        'INTERNAL_API_KEY is not configured. Server-to-server endpoints are inaccessible.',
      );
      throw new UnauthorizedException('Internal API key not configured');
    }

    // Extract API key header safely (avoids object injection warning)
    const headerEntries = Object.entries(request.headers);
    const apiKeyEntry = headerEntries.find(
      ([key]) => key === INTERNAL_API_KEY_HEADER,
    );
    const providedKey = apiKeyEntry ? apiKeyEntry[1] : undefined;

    if (!providedKey) {
      this.logger.warn('Missing internal API key', {
        method: request.method,
        path: request.url.split('?')[0],
        ip: request.ip,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Internal API key is required');
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.timingSafeEqual(providedKey, this.configuredKey)) {
      this.logger.warn('Invalid internal API key', {
        method: request.method,
        path: request.url.split('?')[0],
        ip: request.ip,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   * Both strings are compared byte-by-byte regardless of where they differ.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do a comparison to maintain constant time for same-length check
      // but the length difference already leaks some info (unavoidable)
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      // XOR each character code; any difference sets bits in result
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
