import { NotFoundException } from '@nestjs/common';
import { GenerateScriptUseCase } from '../../../../../src/modules/capsules/application/use-cases/generate-script.use-case';
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

const mockScriptGenerator = {
  generate: jest.fn(),
};

const makeCapsule = (): Capsule => {
  const capsule = new Capsule({
    title: 'Test Capsule',
    sectorId: 'sector-1',
    type: CapsuleType.AUDIO,
    createdBy: 'user-1',
  });
  (capsule as unknown as Record<string, unknown>)['id'] = 'cap-1';
  return capsule;
};

describe('GenerateScriptUseCase', () => {
  let useCase: GenerateScriptUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GenerateScriptUseCase(
      mockRepository as any,
      mockScriptGenerator as any,
    );
  });

  it('generates script and persists it on the capsule', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.getSources.mockResolvedValue([
      { id: 'src-1', title: 'Doc', sourceType: 'PDF' },
    ]);
    mockScriptGenerator.generate.mockResolvedValue({
      script: 'Narrative script content here',
    });
    mockRepository.save.mockResolvedValue(capsule);

    const result = await useCase.execute('cap-1');

    expect(mockScriptGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIds: ['src-1'],
        sectorId: 'sector-1',
      }),
    );
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(result.script).toBe('Narrative script content here');
  });

  it('throws NotFoundException when capsule does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('passes language parameter to script generator', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.getSources.mockResolvedValue([]);
    mockScriptGenerator.generate.mockResolvedValue({ script: 'Script en español' });
    mockRepository.save.mockResolvedValue(capsule);

    await useCase.execute('cap-1', 'es');

    expect(mockScriptGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'es' }),
    );
  });
});
