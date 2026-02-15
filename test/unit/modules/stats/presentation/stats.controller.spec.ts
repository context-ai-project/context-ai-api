import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { StatsController } from '../../../../../src/modules/stats/presentation/stats.controller';
import { UserRepository } from '../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';
import { SectorStatus } from '@shared/types';
import { JwtAuthGuard } from '../../../../../src/modules/auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../../../../src/modules/auth/guards/rbac.guard';
import { PermissionService } from '../../../../../src/modules/auth/application/services/permission.service';
import { TokenRevocationService } from '../../../../../src/modules/auth/application/services/token-revocation.service';

describe('StatsController', () => {
  let controller: StatsController;

  // ── Mocks ────────────────────────────────────────────────────────────────

  const mockUserRepository = {
    countAll: jest.fn(),
    countRecent: jest.fn(),
    findByAuth0UserId: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithRoles: jest.fn(),
    save: jest.fn(),
  };

  const mockConversationRepository = {
    countAll: jest.fn(),
    countByUserId: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findBySectorId: jest.fn(),
    findByUserAndSector: jest.fn(),
    addMessage: jest.fn(),
    getMessages: jest.fn(),
    delete: jest.fn(),
    findActiveConversations: jest.fn(),
    transaction: jest.fn(),
  };

  const mockSectorRepository = {
    findAll: jest.fn(),
    findAllActive: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    existsByName: jest.fn(),
    countAll: jest.fn(),
    countByStatus: jest.fn(),
  };

  const mockKnowledgeRepository = {
    findAllSources: jest.fn(),
    countAllSources: jest.fn(),
    countSourcesBySector: jest.fn(),
    countSourcesBySectorIds: jest.fn(),
    findSourcesBySector: jest.fn(),
    findSourceById: jest.fn(),
    findSourcesByStatus: jest.fn(),
    saveSource: jest.fn(),
    softDeleteSource: jest.fn(),
    deleteSource: jest.fn(),
    saveFragments: jest.fn(),
    findFragmentById: jest.fn(),
    findFragmentsBySource: jest.fn(),
    deleteFragmentsBySource: jest.fn(),
    countFragmentsBySource: jest.fn(),
    transaction: jest.fn(),
  };

  // ── Setup ────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: UserRepository, useValue: mockUserRepository },
        {
          provide: 'IConversationRepository',
          useValue: mockConversationRepository,
        },
        { provide: 'ISectorRepository', useValue: mockSectorRepository },
        { provide: 'IKnowledgeRepository', useValue: mockKnowledgeRepository },
        // Auth guards (global but need mocked providers)
        JwtAuthGuard,
        RBACGuard,
        Reflector,
        {
          provide: PermissionService,
          useValue: { getUserPermissions: jest.fn() },
        },
        {
          provide: TokenRevocationService,
          useValue: { isTokenRevoked: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);

    jest.clearAllMocks();
  });

  // ── Tests ────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return aggregated admin stats', async () => {
      mockConversationRepository.countAll.mockResolvedValue(42);
      mockUserRepository.countAll.mockResolvedValue(15);
      mockUserRepository.countRecent.mockResolvedValue(3);
      mockKnowledgeRepository.countAllSources.mockResolvedValue(10);
      mockSectorRepository.countAll.mockResolvedValue(3);
      mockSectorRepository.countByStatus.mockResolvedValue(2);

      const result = await controller.getStats();

      expect(result).toEqual({
        totalConversations: 42,
        totalUsers: 15,
        recentUsers: 3,
        totalDocuments: 10,
        totalSectors: 3,
        activeSectors: 2,
      });

      expect(mockConversationRepository.countAll).toHaveBeenCalled();
      expect(mockUserRepository.countAll).toHaveBeenCalled();
      expect(mockUserRepository.countRecent).toHaveBeenCalled();
      expect(mockKnowledgeRepository.countAllSources).toHaveBeenCalled();
      expect(mockSectorRepository.countAll).toHaveBeenCalled();
      expect(mockSectorRepository.countByStatus).toHaveBeenCalledWith(SectorStatus.ACTIVE);
    });

    it('should return zeros when no data exists', async () => {
      mockConversationRepository.countAll.mockResolvedValue(0);
      mockUserRepository.countAll.mockResolvedValue(0);
      mockUserRepository.countRecent.mockResolvedValue(0);
      mockKnowledgeRepository.countAllSources.mockResolvedValue(0);
      mockSectorRepository.countAll.mockResolvedValue(0);
      mockSectorRepository.countByStatus.mockResolvedValue(0);

      const result = await controller.getStats();

      expect(result).toEqual({
        totalConversations: 0,
        totalUsers: 0,
        recentUsers: 0,
        totalDocuments: 0,
        totalSectors: 0,
        activeSectors: 0,
      });
    });

    it('should propagate errors from repositories', async () => {
      mockConversationRepository.countAll.mockRejectedValue(
        new Error('DB connection failed'),
      );
      mockUserRepository.countAll.mockResolvedValue(0);
      mockUserRepository.countRecent.mockResolvedValue(0);
      mockKnowledgeRepository.countAllSources.mockResolvedValue(0);
      mockSectorRepository.countAll.mockResolvedValue(0);
      mockSectorRepository.countByStatus.mockResolvedValue(0);

      await expect(controller.getStats()).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should correctly report active sectors count', async () => {
      mockConversationRepository.countAll.mockResolvedValue(0);
      mockUserRepository.countAll.mockResolvedValue(0);
      mockUserRepository.countRecent.mockResolvedValue(0);
      mockKnowledgeRepository.countAllSources.mockResolvedValue(0);
      mockSectorRepository.countAll.mockResolvedValue(5);
      mockSectorRepository.countByStatus.mockResolvedValue(3);

      const result = await controller.getStats();

      expect(result.totalSectors).toBe(5);
      expect(result.activeSectors).toBe(3);
    });
  });
});
