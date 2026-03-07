import { NotFoundException } from '@nestjs/common';
import { UpdateCapsuleUseCase } from '../../../../../src/modules/capsules/application/use-cases/update-capsule.use-case';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

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

function makeCapsule(overrides: Partial<Record<string, unknown>> = {}): Capsule {
  const c = new Capsule({
    title: 'Original',
    sectorId: 'sector-1',
    type: CapsuleType.AUDIO,
    createdBy: 'user-1',
  });
  (c as any).id = 'cap-1';
  (c as any).status = CapsuleStatus.DRAFT;
  Object.assign(c, overrides);
  return c;
}

describe('UpdateCapsuleUseCase', () => {
  let useCase: UpdateCapsuleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateCapsuleUseCase(mockRepository as any);
  });

  it('updates capsule and returns saved entity with sources', async () => {
    const capsule = makeCapsule();
    const saved = makeCapsule({ title: 'Updated Title', introText: 'Intro' });
    const sources = [{ id: 'src-1', title: 'Doc', sourceType: 'PDF' }];
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.save.mockResolvedValue(saved);
    mockRepository.getSources.mockResolvedValue(sources);

    const result = await useCase.execute({
      capsuleId: 'cap-1',
      title: 'Updated Title',
      introText: 'Intro',
    });

    expect(mockRepository.findById).toHaveBeenCalledWith('cap-1');
    expect(mockRepository.save).toHaveBeenCalledWith(capsule);
    expect(mockRepository.getSources).toHaveBeenCalledWith('cap-1');
    expect(result).toBe(saved);
    expect(result.sources).toEqual(sources);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ capsuleId: 'missing', title: 'New' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
