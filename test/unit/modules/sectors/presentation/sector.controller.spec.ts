import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SectorController } from '../../../../../src/modules/sectors/presentation/sector.controller';
import { CreateSectorUseCase } from '../../../../../src/modules/sectors/application/use-cases/create-sector.use-case';
import { UpdateSectorUseCase } from '../../../../../src/modules/sectors/application/use-cases/update-sector.use-case';
import { DeleteSectorUseCase } from '../../../../../src/modules/sectors/application/use-cases/delete-sector.use-case';
import { ToggleSectorStatusUseCase } from '../../../../../src/modules/sectors/application/use-cases/toggle-sector-status.use-case';
import { Sector } from '../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon, SectorStatus } from '@shared/types';
import { JwtAuthGuard } from '../../../../../src/modules/auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../../../../src/modules/auth/guards/rbac.guard';
import { PermissionService } from '../../../../../src/modules/auth/application/services/permission.service';
import { TokenRevocationService } from '../../../../../src/modules/auth/application/services/token-revocation.service';

describe('SectorController', () => {
  let controller: SectorController;

  const sectorId = '440e8400-e29b-41d4-a716-446655440000';

  function createTestSector(overrides?: Partial<{
    id: string;
    name: string;
    status: SectorStatus;
  }>): Sector {
    const sector = new Sector({
      name: overrides?.name ?? 'Human Resources',
      description: 'Company policies, benefits, onboarding guides, and employee handbook.',
      icon: SectorIcon.USERS,
    });
    const mutable = sector as { id?: string; status: SectorStatus };
    mutable.id = overrides?.id ?? sectorId;
    if (overrides?.status) {
      mutable.status = overrides.status;
    }
    return sector;
  }

  const mockSectorRepository = {
    save: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    findAllActive: jest.fn(),
    delete: jest.fn(),
    existsByName: jest.fn(),
  };

  const mockKnowledgeRepository = {
    countSourcesBySector: jest.fn(),
    countSourcesBySectorIds: jest.fn(),
    countAllSources: jest.fn(),
    findAllSources: jest.fn(),
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

  const mockCreateUseCase = { execute: jest.fn() };
  const mockUpdateUseCase = { execute: jest.fn() };
  const mockDeleteUseCase = { execute: jest.fn() };
  const mockToggleUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SectorController],
      providers: [
        { provide: CreateSectorUseCase, useValue: mockCreateUseCase },
        { provide: UpdateSectorUseCase, useValue: mockUpdateUseCase },
        { provide: DeleteSectorUseCase, useValue: mockDeleteUseCase },
        { provide: ToggleSectorStatusUseCase, useValue: mockToggleUseCase },
        { provide: 'ISectorRepository', useValue: mockSectorRepository },
        { provide: 'IKnowledgeRepository', useValue: mockKnowledgeRepository },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: RBACGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: PermissionService, useValue: { hasPermissions: jest.fn() } },
        { provide: TokenRevocationService, useValue: { isTokenRevoked: jest.fn() } },
      ],
    }).compile();

    controller = module.get<SectorController>(SectorController);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('listSectors', () => {
    it('should return all sectors with document counts', async () => {
      const sectors = [
        createTestSector(),
        createTestSector({ id: '440e8400-e29b-41d4-a716-446655440001', name: 'Engineering' }),
      ];
      mockSectorRepository.findAll.mockResolvedValue(sectors);

      const countsMap = new Map<string, number>();
      countsMap.set(sectorId, 18);
      countsMap.set('440e8400-e29b-41d4-a716-446655440001', 24);
      mockKnowledgeRepository.countSourcesBySectorIds.mockResolvedValue(countsMap);

      const result = await controller.listSectors();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Human Resources');
      expect(result[0].documentCount).toBe(18);
      expect(result[1].name).toBe('Engineering');
      expect(result[1].documentCount).toBe(24);
      expect(mockKnowledgeRepository.countSourcesBySectorIds).toHaveBeenCalledWith([
        sectorId,
        '440e8400-e29b-41d4-a716-446655440001',
      ]);
    });

    it('should return empty array when no sectors exist', async () => {
      mockSectorRepository.findAll.mockResolvedValue([]);
      mockKnowledgeRepository.countSourcesBySectorIds.mockResolvedValue(new Map());

      const result = await controller.listSectors();

      expect(result).toHaveLength(0);
    });
  });

  describe('getSector', () => {
    it('should return a sector by ID', async () => {
      mockSectorRepository.findById.mockResolvedValue(createTestSector());
      mockKnowledgeRepository.countSourcesBySector.mockResolvedValue(10);

      const result = await controller.getSector(sectorId);

      expect(result.id).toBe(sectorId);
      expect(result.name).toBe('Human Resources');
      expect(result.documentCount).toBe(10);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(controller.getSector('not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when sector not found', async () => {
      mockSectorRepository.findById.mockResolvedValue(null);

      await expect(controller.getSector(sectorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createSector', () => {
    it('should create a new sector', async () => {
      const createdSector = createTestSector();
      mockCreateUseCase.execute.mockResolvedValue(createdSector);

      const result = await controller.createSector({
        name: 'Human Resources',
        description: 'Company policies, benefits, onboarding guides, and employee handbook.',
        icon: SectorIcon.USERS,
      });

      expect(result.name).toBe('Human Resources');
      expect(result.documentCount).toBe(0);
    });

    it('should propagate ConflictException from use case', async () => {
      mockCreateUseCase.execute.mockRejectedValue(
        new ConflictException('already exists'),
      );

      await expect(
        controller.createSector({
          name: 'Existing',
          description: 'Description that is long enough for validation.',
          icon: SectorIcon.USERS,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateSector', () => {
    it('should update a sector', async () => {
      const updatedSector = createTestSector({ name: 'HR Department' });
      mockUpdateUseCase.execute.mockResolvedValue(updatedSector);
      mockKnowledgeRepository.countSourcesBySector.mockResolvedValue(5);

      const result = await controller.updateSector(sectorId, {
        name: 'HR Department',
      });

      expect(result.name).toBe('HR Department');
      expect(result.documentCount).toBe(5);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.updateSector('bad-uuid', { name: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSector', () => {
    it('should delete a sector', async () => {
      mockDeleteUseCase.execute.mockResolvedValue({
        id: sectorId,
        message: 'Sector deleted successfully',
      });

      const result = await controller.deleteSector(sectorId);

      expect(result.id).toBe(sectorId);
      expect(result.message).toBe('Sector deleted successfully');
    });

    it('should propagate BadRequestException when sector has documents', async () => {
      mockDeleteUseCase.execute.mockRejectedValue(
        new BadRequestException('has associated documents'),
      );

      await expect(controller.deleteSector(sectorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleStatus', () => {
    it('should toggle sector status', async () => {
      mockToggleUseCase.execute.mockResolvedValue({
        id: sectorId,
        status: SectorStatus.INACTIVE,
        message: 'Sector deactivated successfully',
      });

      const result = await controller.toggleStatus(sectorId);

      expect(result.status).toBe(SectorStatus.INACTIVE);
      expect(result.message).toBe('Sector deactivated successfully');
    });

    it('should propagate NotFoundException when sector not found', async () => {
      mockToggleUseCase.execute.mockRejectedValue(
        new NotFoundException('Sector not found'),
      );

      await expect(controller.toggleStatus(sectorId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

