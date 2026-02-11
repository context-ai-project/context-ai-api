import { Test, TestingModule } from '@nestjs/testing';
import { TokenRevocationService } from '../../../../../src/modules/auth/application/services/token-revocation.service';

describe('TokenRevocationService', () => {
  let service: TokenRevocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenRevocationService],
    }).compile();

    service = module.get<TokenRevocationService>(TokenRevocationService);
  });

  afterEach(() => {
    // Clean up after each test
    service.clearAllRevokedTokens();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('revokeToken', () => {
    it('should revoke a valid token', () => {
      const jti = 'test-jti-123';
      const exp = Math.floor(Date.now() / 1000) + 3600; // Expires in 1 hour

      service.revokeToken(jti, exp);

      expect(service.isTokenRevoked(jti)).toBe(true);
      expect(service.getRevokedTokenCount()).toBe(1);
    });

    it('should not revoke a token without JTI', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken('', exp);

      expect(service.getRevokedTokenCount()).toBe(0);
    });

    it('should not store already-expired tokens', () => {
      const jti = 'expired-jti-123';
      const exp = Math.floor(Date.now() / 1000) - 3600; // Expired 1 hour ago

      service.revokeToken(jti, exp);

      expect(service.isTokenRevoked(jti)).toBe(false);
      expect(service.getRevokedTokenCount()).toBe(0);
    });

    it('should handle multiple token revocations', () => {
      const jti1 = 'test-jti-1';
      const jti2 = 'test-jti-2';
      const jti3 = 'test-jti-3';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken(jti1, exp);
      service.revokeToken(jti2, exp);
      service.revokeToken(jti3, exp);

      expect(service.getRevokedTokenCount()).toBe(3);
      expect(service.isTokenRevoked(jti1)).toBe(true);
      expect(service.isTokenRevoked(jti2)).toBe(true);
      expect(service.isTokenRevoked(jti3)).toBe(true);
    });

    it('should update expiration if same JTI is revoked again', () => {
      const jti = 'test-jti-123';
      const exp1 = Math.floor(Date.now() / 1000) + 3600;
      const exp2 = Math.floor(Date.now() / 1000) + 7200; // 2 hours

      service.revokeToken(jti, exp1);
      service.revokeToken(jti, exp2);

      // Should still have only 1 token (same JTI)
      expect(service.getRevokedTokenCount()).toBe(1);
      expect(service.isTokenRevoked(jti)).toBe(true);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false for non-revoked tokens', () => {
      const jti = 'not-revoked-jti';

      expect(service.isTokenRevoked(jti)).toBe(false);
    });

    it('should return true for revoked tokens', () => {
      const jti = 'revoked-jti';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken(jti, exp);

      expect(service.isTokenRevoked(jti)).toBe(true);
    });

    it('should return false for tokens without JTI', () => {
      expect(service.isTokenRevoked('')).toBe(false);
    });

    it('should automatically remove expired token from revocation list', () => {
      const jti = 'test-jti-123';
      // Set expiration to 1 second from now
      const exp = Math.floor(Date.now() / 1000) + 1;

      service.revokeToken(jti, exp);

      // Token should be revoked initially
      expect(service.isTokenRevoked(jti)).toBe(true);
      expect(service.getRevokedTokenCount()).toBe(1);

      // Wait for token to expire (1.5 seconds)
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Token should no longer be revoked (naturally expired)
          expect(service.isTokenRevoked(jti)).toBe(false);
          expect(service.getRevokedTokenCount()).toBe(0);
          resolve();
        }, 1500);
      });
    });
  });

  describe('clearAllRevokedTokens', () => {
    it('should clear all revoked tokens', () => {
      const jti1 = 'test-jti-1';
      const jti2 = 'test-jti-2';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken(jti1, exp);
      service.revokeToken(jti2, exp);

      expect(service.getRevokedTokenCount()).toBe(2);

      service.clearAllRevokedTokens();

      expect(service.getRevokedTokenCount()).toBe(0);
      expect(service.isTokenRevoked(jti1)).toBe(false);
      expect(service.isTokenRevoked(jti2)).toBe(false);
    });

    it('should handle clearing empty list', () => {
      expect(service.getRevokedTokenCount()).toBe(0);

      service.clearAllRevokedTokens();

      expect(service.getRevokedTokenCount()).toBe(0);
    });
  });

  describe('getRevokedTokenCount', () => {
    it('should return 0 for empty list', () => {
      expect(service.getRevokedTokenCount()).toBe(0);
    });

    it('should return correct count after revocations', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken('jti-1', exp);
      expect(service.getRevokedTokenCount()).toBe(1);

      service.revokeToken('jti-2', exp);
      expect(service.getRevokedTokenCount()).toBe(2);

      service.revokeToken('jti-3', exp);
      expect(service.getRevokedTokenCount()).toBe(3);
    });
  });

  describe('getStatistics', () => {
    it('should return empty statistics for empty list', () => {
      const stats = service.getStatistics();

      expect(stats.totalRevoked).toBe(0);
      expect(stats.oldestExpiration).toBeNull();
      expect(stats.newestExpiration).toBeNull();
    });

    it('should return correct statistics for revoked tokens', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp1 = now + 1800; // 30 minutes from now
      const exp2 = now + 3600; // 1 hour from now
      const exp3 = now + 7200; // 2 hours from now

      service.revokeToken('jti-1', exp1);
      service.revokeToken('jti-2', exp2);
      service.revokeToken('jti-3', exp3);

      const stats = service.getStatistics();

      expect(stats.totalRevoked).toBe(3);
      expect(stats.oldestExpiration).toEqual(new Date(exp1 * 1000));
      expect(stats.newestExpiration).toEqual(new Date(exp3 * 1000));
    });

    it('should return same value for oldest and newest if only one token', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken('jti-1', exp);

      const stats = service.getStatistics();

      expect(stats.totalRevoked).toBe(1);
      expect(stats.oldestExpiration).toEqual(new Date(exp * 1000));
      expect(stats.newestExpiration).toEqual(new Date(exp * 1000));
    });
  });

  describe('automatic cleanup', () => {
    it('should not clean up non-expired tokens', () => {
      const jti = 'test-jti-123';
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      service.revokeToken(jti, exp);

      // Manually trigger cleanup (accessing private method for testing)
      // In real scenario, this runs automatically every 10 minutes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).cleanupExpiredTokens();

      // Token should still be there
      expect(service.isTokenRevoked(jti)).toBe(true);
      expect(service.getRevokedTokenCount()).toBe(1);
    });

    it('should clean up expired tokens during cleanup', () => {
      const jti1 = 'expired-jti';
      const jti2 = 'valid-jti';
      // Token that expired 1 hour ago
      const expiredExp = Math.floor(Date.now() / 1000) - 3600;
      // Token that expires in 1 hour
      const validExp = Math.floor(Date.now() / 1000) + 3600;

      // Manually add expired token to the map (bypassing revokeToken validation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).revokedTokens.set(jti1, expiredExp * 1000);
      service.revokeToken(jti2, validExp);

      expect(service.getRevokedTokenCount()).toBe(2);

      // Manually trigger cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).cleanupExpiredTokens();

      // Expired token should be removed
      expect(service.getRevokedTokenCount()).toBe(1);
      expect(service.isTokenRevoked(jti1)).toBe(false);
      expect(service.isTokenRevoked(jti2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very large JTI strings', () => {
      const longJti = 'a'.repeat(10000);
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken(longJti, exp);

      expect(service.isTokenRevoked(longJti)).toBe(true);
    });

    it('should handle special characters in JTI', () => {
      const specialJti = 'jti-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.revokeToken(specialJti, exp);

      expect(service.isTokenRevoked(specialJti)).toBe(true);
    });

    it('should handle expiration timestamp boundaries', () => {
      const jti = 'boundary-jti';
      const exp = Math.floor(Date.now() / 1000) + 1; // Expires in 1 second

      service.revokeToken(jti, exp);

      expect(service.isTokenRevoked(jti)).toBe(true);

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(service.isTokenRevoked(jti)).toBe(false);
          resolve();
        }, 1500);
      });
    });
  });
});

