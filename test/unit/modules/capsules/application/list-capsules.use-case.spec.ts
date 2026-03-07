import { ListCapsulesUseCase } from '../../../../../src/modules/capsules/application/use-cases/list-capsules.use-case';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';
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

describe('ListCapsulesUseCase', () => {
  let useCase: ListCapsulesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListCapsulesUseCase(mockRepository as any);
  });

  it('returns paginated result with default page and limit', async () => {
    const capsule = new Capsule({
      title: 'Capsule',
      sectorId: 'sector-1',
      type: CapsuleType.AUDIO,
      createdBy: 'user-1',
    });
    (capsule as any).id = 'cap-1';
    const paginated = { data: [capsule], total: 1, page: 1, limit: 20 };
    mockRepository.findAll.mockResolvedValue(paginated);

    const result = await useCase.execute({});

    expect(mockRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ excludeArchived: true }),
      { page: 1, limit: 20 },
    );
    expect(result).toEqual(paginated);
  });

  it('applies onlyActive and sets status filter to ACTIVE', async () => {
    mockRepository.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await useCase.execute({ onlyActive: true });

    expect(mockRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: CapsuleStatus.ACTIVE }),
      expect.any(Object),
    );
  });

  it('applies explicit status filter when provided', async () => {
    mockRepository.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

    await useCase.execute({ status: CapsuleStatus.ARCHIVED, page: 2, limit: 10 });

    expect(mockRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: CapsuleStatus.ARCHIVED }),
      { page: 2, limit: 10 },
    );
  });

  it('clamps limit to MAX_LIMIT and page to MIN_PAGE', async () => {
    mockRepository.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });

    await useCase.execute({ page: 0, limit: 100 });

    expect(mockRepository.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      { page: 1, limit: 50 },
    );
  });

  it('passes sectorId, type, search, createdBy in filters', async () => {
    mockRepository.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await useCase.execute({
      sectorId: 'sec-1',
      type: CapsuleType.AUDIO,
      search: 'policy',
      createdBy: 'auth0|user1',
    });

    expect(mockRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        sectorId: 'sec-1',
        type: CapsuleType.AUDIO,
        search: 'policy',
        createdBy: 'auth0|user1',
      }),
      expect.any(Object),
    );
  });
});
