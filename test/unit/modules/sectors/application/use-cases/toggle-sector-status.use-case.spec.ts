import { NotFoundException } from '@nestjs/common';
import { ToggleSectorStatusUseCase } from '../../../../../../src/modules/sectors/application/use-cases/toggle-sector-status.use-case';
import { Sector } from '../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon, SectorStatus } from '@shared/types';
import type { ISectorRepository } from '../../../../../../src/modules/sectors/domain/repositories/sector.repository.interface';

describe('ToggleSectorStatusUseCase', () => {
  let useCase: ToggleSectorStatusUseCase;
  let mockRepository: jest.Mocked<ISectorRepository>;

  const sectorId = '123e4567-e89b-12d3-a456-426614174000';

  function createTestSector(status: SectorStatus = SectorStatus.ACTIVE): Sector {
    const sector = new Sector({
      name: 'Human Resources',
      description: 'Company policies, benefits, onboarding guides, and employee handbook.',
      icon: SectorIcon.USERS,
    });
    const mutable = sector as { id?: string; status: SectorStatus };
    mutable.id = sectorId;
    mutable.status = status;
    return sector;
  }

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      delete: jest.fn(),
      existsByName: jest.fn(),
    };

    useCase = new ToggleSectorStatusUseCase(mockRepository);
  });

  it('should toggle active sector to inactive', async () => {
    const sector = createTestSector(SectorStatus.ACTIVE);
    mockRepository.findById.mockResolvedValue(sector);
    mockRepository.save.mockImplementation(async (s: Sector) => s);

    const result = await useCase.execute(sectorId);

    expect(result.status).toBe(SectorStatus.INACTIVE);
    expect(result.message).toBe('Sector deactivated successfully');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should toggle inactive sector to active', async () => {
    const sector = createTestSector(SectorStatus.INACTIVE);
    mockRepository.findById.mockResolvedValue(sector);
    mockRepository.save.mockImplementation(async (s: Sector) => s);

    const result = await useCase.execute(sectorId);

    expect(result.status).toBe(SectorStatus.ACTIVE);
    expect(result.message).toBe('Sector activated successfully');
  });

  it('should throw NotFoundException when sector does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(sectorId)).rejects.toThrow(
      NotFoundException,
    );
  });
});

