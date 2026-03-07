import { NotFoundException } from '@nestjs/common';
import { DeleteCapsuleUseCase } from '../../../../../src/modules/capsules/application/use-cases/delete-capsule.use-case';
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

function makeCapsule(status = CapsuleStatus.DRAFT): Capsule {
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

describe('DeleteCapsuleUseCase', () => {
  let useCase: DeleteCapsuleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteCapsuleUseCase(mockRepository as any);
  });

  it('soft-deletes capsule and saves', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.save.mockResolvedValue(capsule);

    await useCase.execute('cap-1');

    expect(capsule.status).toBe(CapsuleStatus.ARCHIVED);
    expect(mockRepository.save).toHaveBeenCalledWith(capsule);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
