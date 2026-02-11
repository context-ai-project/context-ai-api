import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../../../../src/modules/audit/application/services/audit.service';
import { AuditLogRepository } from '../../../../../src/modules/audit/infrastructure/persistence/repositories/audit-log.repository';
import { AuditEventType } from '../../../../../src/modules/audit/domain/entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repository: jest.Mocked<AuditLogRepository>;

  const mockRepository = {
    save: jest.fn(),
    findByUserId: jest.fn(),
    findByEventType: jest.fn(),
    findSecurityThreats: jest.fn(),
    countByUserId: jest.fn(),
    deleteOlderThan: jest.fn(),
  };

  const mockContext = {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AuditLogRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get(AuditLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logLogin', () => {
    it('should log a successful login event', async () => {
      const userId = 'user-uuid-123';

      await service.logLogin(userId, mockContext);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOGIN,
          userId,
          ipAddress: mockContext.ip,
          userAgent: mockContext.userAgent,
        }),
      );
    });

    it('should log login with metadata', async () => {
      const userId = 'user-uuid-123';
      const metadata = { provider: 'auth0', method: 'oauth' };

      await service.logLogin(userId, mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOGIN,
          userId,
          metadata,
        }),
      );
    });
  });

  describe('logLogout', () => {
    it('should log a logout event', async () => {
      const userId = 'user-uuid-123';

      await service.logLogout(userId, mockContext);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOGOUT,
          userId,
        }),
      );
    });
  });

  describe('logLoginFailed', () => {
    it('should log a failed login attempt without userId', async () => {
      const metadata = { error: 'Invalid token' };

      await service.logLoginFailed(mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.LOGIN_FAILED,
          userId: null,
          metadata,
        }),
      );
    });
  });

  describe('logAccessDenied', () => {
    it('should log an access denied event with userId', async () => {
      const userId = 'user-uuid-123';
      const metadata = { resource: '/admin/users', requiredPermission: 'users:manage' };

      await service.logAccessDenied(userId, mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.ACCESS_DENIED,
          userId,
          metadata,
        }),
      );
    });

    it('should log an access denied event without userId (unauthenticated)', async () => {
      const metadata = { resource: '/admin/users' };

      await service.logAccessDenied(null, mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.ACCESS_DENIED,
          userId: null,
          metadata,
        }),
      );
    });
  });

  describe('logRoleChanged', () => {
    it('should log a role change event', async () => {
      const userId = 'user-uuid-123';
      const metadata = {
        oldRole: 'user',
        newRole: 'manager',
        changedBy: 'admin-uuid-456',
      };

      await service.logRoleChanged(userId, mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.ROLE_CHANGED,
          userId,
          metadata,
        }),
      );
    });
  });

  describe('logTokenRevoked', () => {
    it('should log a token revocation event', async () => {
      const userId = 'user-uuid-123';
      const metadata = { jti: 'token-jti-123' };

      await service.logTokenRevoked(userId, mockContext, metadata);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.TOKEN_REVOKED,
          userId,
          metadata,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should not throw error when repository fails', async () => {
      repository.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.logLogin('user-uuid-123', mockContext),
      ).resolves.not.toThrow();
    });

    it('should log error when repository fails', async () => {
      const loggerErrorSpy = jest.spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error');
      repository.save.mockRejectedValue(new Error('Database error'));

      await service.logLogin('user-uuid-123', mockContext);

      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getUserAuditLogs', () => {
    it('should retrieve audit logs for a user', async () => {
      const userId = 'user-uuid-123';
      repository.findByUserId.mockResolvedValue([]);

      await service.getUserAuditLogs(userId);

      expect(repository.findByUserId).toHaveBeenCalledWith(userId, undefined);
    });

    it('should retrieve audit logs with pagination', async () => {
      const userId = 'user-uuid-123';
      const options = { limit: 50, offset: 100 };
      repository.findByUserId.mockResolvedValue([]);

      await service.getUserAuditLogs(userId, options);

      expect(repository.findByUserId).toHaveBeenCalledWith(userId, options);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than retention period', async () => {
      const retentionDays = 365;
      repository.deleteOlderThan.mockResolvedValue(100);

      const deletedCount = await service.cleanupOldLogs(retentionDays);

      expect(deletedCount).toBe(100);
      expect(repository.deleteOlderThan).toHaveBeenCalledWith(
        expect.any(Date),
      );
    });

    it('should calculate correct cutoff date', async () => {
      const retentionDays = 30;
      repository.deleteOlderThan.mockResolvedValue(10);

      await service.cleanupOldLogs(retentionDays);

      const callArg = repository.deleteOlderThan.mock.calls[0][0] as Date;
      const daysDiff = Math.floor(
        (Date.now() - callArg.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDiff).toBe(retentionDays);
    });
  });
});

