import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateSectorUseCase } from '../../../../../../src/modules/sectors/application/use-cases/update-sector.use-case';
import { Sector } from '../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon } from '@shared/types';
import type { ISectorRepository } from '../../../../../../src/modules/sectors/domain/repositories/sector.repository.interface';

describe('UpdateSectorUseCase', () => {
  let useCase: UpdateSectorUseCase;
  let mockRepository: jest.Mocked<ISectorRepository>;

  const sectorId = '123e4567-e89b-12d3-a456-426614174000';

  function createTestSector(): Sector {
    const sector = new Sector({
      name: 'Human Resources',
      description: 'Company policies, benefits, onboarding guides, and employee handbook.',
      icon: SectorIcon.USERS,
    });
    const mutable = sector as { id?: string };
    mutable.id = sectorId;
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

    useCase = new UpdateSectorUseCase(mockRepository);
  });

  it('should update a sector name successfully', async () => {
    const existingSector = createTestSector();
    mockRepository.findById.mockResolvedValue(existingSector);
    mockRepository.existsByName.mockResolvedValue(false);
    mockRepository.save.mockImplementation(async (sector: Sector) => sector);

    const result = await useCase.execute({
      id: sectorId,
      name: 'Engineering Team',
    });

    expect(result.name).toBe('Engineering Team');
    expect(mockRepository.existsByName).toHaveBeenCalledWith(
      'Engineering Team',
      sectorId,
    );
  });

  it('should update description without checking name uniqueness', async () => {
    const existingSector = createTestSector();
    mockRepository.findById.mockResolvedValue(existingSector);
    mockRepository.save.mockImplementation(async (sector: Sector) => sector);

    const result = await useCase.execute({
      id: sectorId,
      description: 'Updated policies and procedures documentation.',
    });

    expect(result.description).toBe(
      'Updated policies and procedures documentation.',
    );
    expect(mockRepository.existsByName).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when sector does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: sectorId, name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when new name already exists', async () => {
    const existingSector = createTestSector();
    mockRepository.findById.mockResolvedValue(existingSector);
    mockRepository.existsByName.mockResolvedValue(true);

    await expect(
      useCase.execute({ id: sectorId, name: 'Existing Name' }),
    ).rejects.toThrow(ConflictException);
  });
});

