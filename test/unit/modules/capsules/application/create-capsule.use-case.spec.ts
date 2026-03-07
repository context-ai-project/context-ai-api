import { BadRequestException } from '@nestjs/common';
import { CreateCapsuleUseCase } from '../../../../../src/modules/capsules/application/use-cases/create-capsule.use-case';
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

const VALID_INPUT = {
  title: 'Vacation Policy Audio',
  sectorId: 'sector-uuid',
  type: CapsuleType.AUDIO,
  sourceIds: ['src-1', 'src-2'],
  createdBy: 'auth0|user1',
};

describe('CreateCapsuleUseCase', () => {
  let useCase: CreateCapsuleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateCapsuleUseCase(mockRepository as any);
  });

  it('creates a capsule in DRAFT status with associated sources', async () => {
    const savedCapsule = new Capsule({
      title: VALID_INPUT.title,
      sectorId: VALID_INPUT.sectorId,
      type: VALID_INPUT.type,
      createdBy: VALID_INPUT.createdBy,
    });
    (savedCapsule as any).id = 'capsule-uuid';

    mockRepository.save.mockResolvedValue(savedCapsule);
    mockRepository.addSources.mockResolvedValue(undefined);
    mockRepository.getSources.mockResolvedValue([
      { id: 'src-1', title: 'Doc 1', sourceType: 'PDF' },
      { id: 'src-2', title: 'Doc 2', sourceType: 'PDF' },
    ]);

    const result = await useCase.execute(VALID_INPUT);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(mockRepository.addSources).toHaveBeenCalledWith('capsule-uuid', VALID_INPUT.sourceIds);
    expect(mockRepository.getSources).toHaveBeenCalledWith('capsule-uuid');
    expect(result.status).toBe(CapsuleStatus.DRAFT);
    expect(result.sources).toHaveLength(2);
  });

  it('throws BadRequestException when no sourceIds are provided', async () => {
    await expect(
      useCase.execute({ ...VALID_INPUT, sourceIds: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when sourceIds is undefined', async () => {
    await expect(
      useCase.execute({ ...VALID_INPUT, sourceIds: undefined as any }),
    ).rejects.toThrow(BadRequestException);
  });
});
