import { NotFoundException } from '@nestjs/common';
import { GetCapsuleUseCase } from '../../../../../src/modules/capsules/application/use-cases/get-capsule.use-case';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';

const mockRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findBySectorId: jest.fn(),
  delete: jest.fn(),
  addSources: jest.fn(),
  getSources: jest.fn(),
  countBySectorAndStatus: jest.fn(),
};

describe('GetCapsuleUseCase', () => {
  let useCase: GetCapsuleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCapsuleUseCase(mockRepository as any);
  });

  it('returns capsule with sources when found', async () => {
    const capsule = new Capsule({
      title: 'Test',
      sectorId: 'sector-1',
      type: CapsuleType.AUDIO,
      createdBy: 'user-1',
    });
    (capsule as any).id = 'cap-1';
    const sources = [
      { id: 'src-1', title: 'Doc 1', sourceType: 'PDF' },
      { id: 'src-2', title: 'Doc 2', sourceType: 'PDF' },
    ];
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.getSources.mockResolvedValue(sources);

    const result = await useCase.execute('cap-1');

    expect(mockRepository.findById).toHaveBeenCalledWith('cap-1');
    expect(mockRepository.getSources).toHaveBeenCalledWith('cap-1');
    expect(result).toBe(capsule);
    expect(result.sources).toEqual(sources);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
    await expect(useCase.execute('missing')).rejects.toThrow(
      'Capsule with ID "missing" not found',
    );
    expect(mockRepository.getSources).not.toHaveBeenCalled();
  });
});
