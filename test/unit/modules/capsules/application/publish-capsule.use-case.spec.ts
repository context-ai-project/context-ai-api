import { NotFoundException } from '@nestjs/common';
import { PublishCapsuleUseCase } from '../../../../../src/modules/capsules/application/use-cases/publish-capsule.use-case';
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

function makeCapsule(status = CapsuleStatus.COMPLETED): Capsule {
  const c = new Capsule({
    title: 'Capsule',
    sectorId: 'sector-1',
    type: CapsuleType.AUDIO,
    createdBy: 'user-1',
  });
  (c as any).id = 'cap-1';
  (c as any).status = status;
  return c;
}

describe('PublishCapsuleUseCase', () => {
  let useCase: PublishCapsuleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new PublishCapsuleUseCase(mockRepository as any);
  });

  it('publishes COMPLETED capsule and returns saved', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.save.mockResolvedValue(capsule);

    const result = await useCase.execute('cap-1');

    expect(capsule.status).toBe(CapsuleStatus.ACTIVE);
    expect(capsule.publishedAt).toBeInstanceOf(Date);
    expect(mockRepository.save).toHaveBeenCalledWith(capsule);
    expect(result).toBe(capsule);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
