import { GenerateVideoUseCase } from '../../../../../src/modules/capsules/application/use-cases/generate-video.use-case';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

const SCENES_JSON = JSON.stringify([
  {
    textToNarrate: 'Welcome',
    visualPrompt: 'office',
    titleOverlay: 'Welcome',
  },
]);

const mockCapsuleRepo = {
  findById: jest.fn(),
  save: jest.fn(),
  findAll: jest.fn(),
  findBySectorId: jest.fn(),
  delete: jest.fn(),
  addSources: jest.fn(),
  getSources: jest.fn(),
  countBySectorAndStatus: jest.fn(),
  countVideoCapsulesThisMonth: jest.fn(),
};

const mockTaskDispatcher = {
  dispatchVideoGeneration: jest.fn(),
};

function makeVideoCapsule(): Capsule {
  const capsule = new Capsule({
    title: 'Test Video',
    sectorId: 'sector-1',
    type: CapsuleType.VIDEO,
    createdBy: 'user-1',
  });
  (capsule as unknown as Record<string, unknown>)['id'] = 'cap-1';
  capsule.updateScript(SCENES_JSON);
  return capsule;
}

describe('GenerateVideoUseCase', () => {
  let useCase: GenerateVideoUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VIDEO_MAX_CAPSULES_PER_MONTH = '10';
    useCase = new GenerateVideoUseCase(
      mockCapsuleRepo as never,
      mockTaskDispatcher as never,
    );
  });

  afterEach(() => {
    delete process.env.VIDEO_MAX_CAPSULES_PER_MONTH;
  });

  it('validates, sets GENERATING_ASSETS, dispatches task, and returns', async () => {
    const capsule = makeVideoCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.countVideoCapsulesThisMonth.mockResolvedValue(2);
    mockCapsuleRepo.save.mockImplementation((c: Capsule) =>
      Promise.resolve(c),
    );
    mockTaskDispatcher.dispatchVideoGeneration.mockResolvedValue(undefined);

    await useCase.execute('cap-1', 'voice-maria');

    expect(mockCapsuleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CapsuleStatus.GENERATING_ASSETS,
      }),
    );
    expect(mockTaskDispatcher.dispatchVideoGeneration).toHaveBeenCalledWith({
      capsuleId: 'cap-1',
      voiceId: 'voice-maria',
    });
  });

  it('throws NotFoundException when capsule does not exist', async () => {
    mockCapsuleRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent', 'v')).rejects.toThrow(
      'not found',
    );
  });

  it('throws when capsule is not VIDEO type', async () => {
    const capsule = new Capsule({
      title: 'Audio Capsule',
      sectorId: 's',
      type: CapsuleType.AUDIO,
      createdBy: 'u',
    });
    (capsule as unknown as Record<string, unknown>)['id'] = 'cap-2';
    capsule.updateScript('plain text');
    mockCapsuleRepo.findById.mockResolvedValue(capsule);

    await expect(useCase.execute('cap-2', 'v')).rejects.toThrow(
      'not a VIDEO capsule',
    );
  });

  it('throws when monthly quota is exhausted', async () => {
    const capsule = makeVideoCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.countVideoCapsulesThisMonth.mockResolvedValue(10);

    await expect(useCase.execute('cap-1', 'voice')).rejects.toThrow(
      'quota',
    );
  });

  it('throws when script is not valid scenes JSON', async () => {
    const capsule = new Capsule({
      title: 'Bad Script',
      sectorId: 's',
      type: CapsuleType.VIDEO,
      createdBy: 'u',
    });
    (capsule as unknown as Record<string, unknown>)['id'] = 'cap-3';
    capsule.updateScript('not json');
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.countVideoCapsulesThisMonth.mockResolvedValue(0);

    await expect(useCase.execute('cap-3', 'voice')).rejects.toThrow(
      'valid scenes',
    );
  });

  describe('getQuotaInfo()', () => {
    it('returns used, limit, remaining', async () => {
      mockCapsuleRepo.countVideoCapsulesThisMonth.mockResolvedValue(3);

      const quota = await useCase.getQuotaInfo();

      expect(quota).toEqual({ used: 3, limit: 10, remaining: 7 });
    });
  });
});
