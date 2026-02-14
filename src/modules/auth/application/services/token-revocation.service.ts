import { Injectable, Logger } from '@nestjs/common';

/**
 * TokenRevocationService
 *
 * Manages a list of revoked JWT tokens (jti - JWT ID) to enable immediate
 * logout and token invalidation before natural expiration.
 *
 * Implementation:
 * - MVP: In-memory Map (tokens cleared on server restart)
 * - Production: Use Redis for persistence and distributed systems
 *
 * Security Considerations:
 * - Only stores token JTI (JWT ID) + expiration time
 * - Automatically cleans up expired tokens
 * - Thread-safe for concurrent operations
 *
 * Phase 6 Implementation:
 * - Issue 6.13: Token Revocation Service ✅
 */
@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);

  /**
   * Map of revoked tokens:
   * Key: JWT ID (jti claim from token)
   * Value: Expiration timestamp (when token naturally expires)
   *
   * Note: We store expiration to automatically clean up old entries
   */
  private readonly revokedTokens = new Map<string, number>();

  /**
   * Interval for automatic cleanup of expired tokens
   * Default: 10 minutes
   */
  private readonly cleanupIntervalMs = 10 * 60 * 1000;

  constructor() {
    // Start automatic cleanup on service initialization
    this.startAutomaticCleanup();
  }

  /**
   * Revoke a token by its JTI (JWT ID).
   *
   * @param jti - The JWT ID (unique identifier from 'jti' claim)
   * @param exp - The expiration timestamp (from 'exp' claim)
   *
   * @example
   * ```typescript
   * // From JWT payload
   * const { jti, exp } = decodedToken;
   * await tokenRevocationService.revokeToken(jti, exp);
   * ```
   */
  revokeToken(jti: string, exp: number): void {
    if (!jti) {
      this.logger.warn('Attempted to revoke token without JTI');
      return;
    }

    // Convert exp (seconds since epoch) to milliseconds
    const expirationMs = exp * 1000;

    // Don't store already-expired tokens
    if (expirationMs <= Date.now()) {
      this.logger.debug('Token already expired, skipping revocation', {
        jti: jti.substring(0, 8) + '...', // Log partial JTI for privacy
        expirationMs,
      });
      return;
    }

    this.revokedTokens.set(jti, expirationMs);

    this.logger.log('Token revoked', {
      jti: jti.substring(0, 8) + '...',
      expiresAt: new Date(expirationMs).toISOString(),
      totalRevoked: this.revokedTokens.size,
    });
  }

  /**
   * Check if a token is revoked.
   *
   * @param jti - The JWT ID to check
   * @returns True if the token is revoked, false otherwise
   *
   * @example
   * ```typescript
   * if (await tokenRevocationService.isTokenRevoked(jti)) {
   *   throw new UnauthorizedException('Token has been revoked');
   * }
   * ```
   */
  isTokenRevoked(jti: string): boolean {
    if (!jti) {
      return false; // No JTI means we can't track revocation
    }

    const expirationMs = this.revokedTokens.get(jti);

    if (!expirationMs) {
      return false; // Token not in revocation list
    }

    // Check if the revocation entry has expired
    if (expirationMs <= Date.now()) {
      // Token naturally expired, remove from list
      this.revokedTokens.delete(jti);
      return false;
    }

    return true; // Token is revoked and still valid (not expired)
  }

  /**
   * Clear all revoked tokens.
   * ⚠️ Use with caution - only for testing or administrative purposes.
   */
  clearAllRevokedTokens(): void {
    const count = this.revokedTokens.size;
    this.revokedTokens.clear();

    this.logger.warn('All revoked tokens cleared', {
      count,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the count of currently revoked tokens.
   * Useful for monitoring and debugging.
   */
  getRevokedTokenCount(): number {
    return this.revokedTokens.size;
  }

  /**
   * Clean up expired tokens from the revocation list.
   * Called periodically by the automatic cleanup timer.
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [jti, expirationMs] of this.revokedTokens.entries()) {
      if (expirationMs <= now) {
        this.revokedTokens.delete(jti);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up expired tokens', {
        cleanedCount,
        remainingCount: this.revokedTokens.size,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Start automatic cleanup of expired tokens.
   * Runs every 10 minutes by default.
   */
  private startAutomaticCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.cleanupIntervalMs);

    this.logger.log('Automatic token cleanup started', {
      intervalMinutes: this.cleanupIntervalMs / 60000,
    });
  }

  /**
   * Get statistics about the revocation service.
   * Useful for monitoring and debugging.
   */
  getStatistics(): {
    totalRevoked: number;
    oldestExpiration: Date | null;
    newestExpiration: Date | null;
  } {
    const expirations = Array.from(this.revokedTokens.values());

    return {
      totalRevoked: expirations.length,
      oldestExpiration:
        expirations.length > 0 ? new Date(Math.min(...expirations)) : null,
      newestExpiration:
        expirations.length > 0 ? new Date(Math.max(...expirations)) : null,
    };
  }
}
