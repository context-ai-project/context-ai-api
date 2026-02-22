import { AuditLogRepository } from '../../../../../../../src/modules/audit/infrastructure/persistence/repositories/audit-log.repository';
import {
  AuditEventType,
  AuditLog,
} from '../../../../../../../src/modules/audit/domain/entities/audit-log.entity';

const AUDIT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function createDomainLog(overrides?: Partial<Parameters<typeof AuditLog.create>[0]>) {
  return AuditLog.create({
    id: AUDIT_ID,
    eventType: AuditEventType.LOGIN,
    userId: USER_ID,
    ipAddress: '127.0.0.1',
    userAgent: 'Jest',
    metadata: { ip: '127.0.0.1' },
    createdAt: CREATED_AT,
    ...overrides,
  });
}

function createModel(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: AUDIT_ID,
    eventType: AuditEventType.LOGIN,
    userId: USER_ID,
    ipAddress: '127.0.0.1',
    userAgent: 'Jest',
    metadata: { ip: '127.0.0.1' },
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockTypeOrmRepository = {
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(() => {
    repository = new AuditLogRepository(mockTypeOrmRepository as never);
    jest.clearAllMocks();
    mockTypeOrmRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
  });

  describe('save', () => {
    it('maps domain entity and saves it', async () => {
      const auditLog = createDomainLog();

      await repository.save(auditLog);

      expect(mockTypeOrmRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: AUDIT_ID,
          eventType: AuditEventType.LOGIN,
          userId: USER_ID,
          ipAddress: '127.0.0.1',
          userAgent: 'Jest',
          metadata: { ip: '127.0.0.1' },
          createdAt: CREATED_AT,
        }),
      );
    });
  });

  describe('findByUserId', () => {
    it('uses default pagination values', async () => {
      mockTypeOrmRepository.find.mockResolvedValue([createModel()]);

      const result = await repository.findByUserId(USER_ID);

      expect(mockTypeOrmRepository.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(AuditEventType.LOGIN);
    });

    it('applies custom pagination options', async () => {
      mockTypeOrmRepository.find.mockResolvedValue([]);

      await repository.findByUserId(USER_ID, { limit: 10, offset: 5 });

      expect(mockTypeOrmRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('findByEventType', () => {
    it('builds query with default limit and no date filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([createModel()]);

      const result = await repository.findByEventType(AuditEventType.LOGIN);

      expect(mockTypeOrmRepository.createQueryBuilder).toHaveBeenCalledWith(
        'audit_log',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'audit_log.eventType = :eventType',
        { eventType: AuditEventType.LOGIN },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(1);
    });

    it('adds startDate and endDate filters when provided', async () => {
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const endDate = new Date('2026-01-31T00:00:00.000Z');
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findByEventType(AuditEventType.LOGIN_FAILED, {
        limit: 25,
        startDate,
        endDate,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.createdAt >= :startDate',
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.createdAt <= :endDate',
        { endDate },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(25);
    });
  });

  describe('findSecurityThreats', () => {
    it('queries threat event types with default limit', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([createModel()]);

      const result = await repository.findSecurityThreats();

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'audit_log.eventType IN (:...threatTypes)',
        {
          threatTypes: [
            AuditEventType.LOGIN_FAILED,
            AuditEventType.ACCESS_DENIED,
            AuditEventType.RATE_LIMIT_EXCEEDED,
          ],
        },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(1);
    });

    it('adds since filter and custom limit', async () => {
      const since = new Date('2026-01-15T00:00:00.000Z');
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findSecurityThreats({ limit: 5, since });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit_log.createdAt >= :since',
        { since },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('countByUserId', () => {
    it('counts logs by user id', async () => {
      mockTypeOrmRepository.count.mockResolvedValue(9);

      const result = await repository.countByUserId(USER_ID);

      expect(mockTypeOrmRepository.count).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(result).toBe(9);
    });
  });

  describe('deleteOlderThan', () => {
    it('returns affected rows when delete succeeds', async () => {
      mockTypeOrmRepository.delete.mockResolvedValue({ affected: 4 });

      const result = await repository.deleteOlderThan(
        new Date('2025-01-01T00:00:00.000Z'),
      );

      expect(mockTypeOrmRepository.delete).toHaveBeenCalledWith({
        createdAt: expect.any(Object),
      });
      expect(result).toBe(4);
    });

    it('returns 0 when affected is undefined', async () => {
      mockTypeOrmRepository.delete.mockResolvedValue({});

      const result = await repository.deleteOlderThan(
        new Date('2025-01-01T00:00:00.000Z'),
      );

      expect(result).toBe(0);
    });
  });
});
