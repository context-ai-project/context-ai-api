import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeleteSectorUseCase } from '../../../../../../src/modules/sectors/application/use-cases/delete-sector.use-case';
import { Sector } from '../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon } from '@shared/types';
import type { ISectorRepository } from '../../../../../../src/modules/sectors/domain/repositories/sector.repository.interface';
import type { IKnowledgeRepository } from '../../../../../../src/modules/knowledge/domain/repositories/knowledge.repository.interface';

describe('DeleteSectorUseCase', () => {
  let useCase: DeleteSectorUseCase;
  let mockSectorRepository: jest.Mocked<ISectorRepository>;
  let mockKnowledgeRepository: jest.Mocked<
    Pick<IKnowledgeRepository, 'countSourcesBySector'>
  >;

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
    mockSectorRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      delete: jest.fn(),
      existsByName: jest.fn(),
    };

    mockKnowledgeRepository = {
      countSourcesBySector: jest.fn(),
    };

    useCase = new DeleteSectorUseCase(
      mockSectorRepository,
      mockKnowledgeRepository as unknown as IKnowledgeRepository,
    );
  });

  it('should delete a sector with no documents', async () => {
    mockSectorRepository.findById.mockResolvedValue(createTestSector());
    mockKnowledgeRepository.countSourcesBySector.mockResolvedValue(0);
    mockSectorRepository.delete.mockResolvedValue(undefined);

    const result = await useCase.execute(sectorId);

    expect(result.id).toBe(sectorId);
    expect(result.message).toBe('Sector deleted successfully');
    expect(mockSectorRepository.delete).toHaveBeenCalledWith(sectorId);
  });

  it('should throw NotFoundException when sector does not exist', async () => {
    mockSectorRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(sectorId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when sector has associated documents', async () => {
    mockSectorRepository.findById.mockResolvedValue(createTestSector());
    mockKnowledgeRepository.countSourcesBySector.mockResolvedValue(5);

    await expect(useCase.execute(sectorId)).rejects.toThrow(
      BadRequestException,
    );
    await expect(useCase.execute(sectorId)).rejects.toThrow(
      'has 5 associated document(s)',
    );
    expect(mockSectorRepository.delete).not.toHaveBeenCalled();
  });
});

