import { ConflictException } from '@nestjs/common';
import { CreateSectorUseCase } from '../../../../../../src/modules/sectors/application/use-cases/create-sector.use-case';
import { Sector } from '../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon, SectorStatus } from '@shared/types';
import type { ISectorRepository } from '../../../../../../src/modules/sectors/domain/repositories/sector.repository.interface';

describe('CreateSectorUseCase', () => {
  let useCase: CreateSectorUseCase;
  let mockRepository: jest.Mocked<ISectorRepository>;

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

    useCase = new CreateSectorUseCase(mockRepository);
  });

  const validInput = {
    name: 'Human Resources',
    description: 'Company policies, benefits, onboarding guides, and employee handbook.',
    icon: SectorIcon.USERS,
  };

  it('should create a sector successfully', async () => {
    mockRepository.existsByName.mockResolvedValue(false);
    mockRepository.save.mockImplementation(async (sector: Sector) => {
      const mutable = sector as { id?: string };
      mutable.id = '123e4567-e89b-12d3-a456-426614174000';
      return sector;
    });

    const result = await useCase.execute(validInput);

    expect(result).toBeInstanceOf(Sector);
    expect(result.name).toBe('Human Resources');
    expect(result.status).toBe(SectorStatus.ACTIVE);
    expect(mockRepository.existsByName).toHaveBeenCalledWith('Human Resources');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException when name already exists', async () => {
    mockRepository.existsByName.mockResolvedValue(true);

    await expect(useCase.execute(validInput)).rejects.toThrow(
      ConflictException,
    );
    await expect(useCase.execute(validInput)).rejects.toThrow(
      'already exists',
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should throw when domain validation fails (empty name)', async () => {
    mockRepository.existsByName.mockResolvedValue(false);

    await expect(
      useCase.execute({ ...validInput, name: '' }),
    ).rejects.toThrow('Sector name cannot be empty');
  });
});

