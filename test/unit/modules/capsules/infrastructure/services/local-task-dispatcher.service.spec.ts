import { LocalTaskDispatcher } from '../../../../../../src/modules/capsules/infrastructure/services/local-task-dispatcher.service';

describe('LocalTaskDispatcher', () => {
  let dispatcher: LocalTaskDispatcher;
  const mockProcessVideo = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const mockPipeline = { processVideo: mockProcessVideo } as never;
    dispatcher = new LocalTaskDispatcher(mockPipeline);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispatches video generation via setImmediate to the pipeline', async () => {
    mockProcessVideo.mockResolvedValue(undefined);

    await dispatcher.dispatchVideoGeneration({
      capsuleId: 'cap-1',
      voiceId: 'voice-1',
    });

    jest.runAllTimers();
    await Promise.resolve();

    expect(mockProcessVideo).toHaveBeenCalledWith('cap-1', 'voice-1');
  });

  it('does not throw when pipeline fails (fire-and-forget)', async () => {
    mockProcessVideo.mockRejectedValue(new Error('Pipeline crash'));

    await expect(
      dispatcher.dispatchVideoGeneration({
        capsuleId: 'cap-1',
        voiceId: 'voice-1',
      }),
    ).resolves.toBeUndefined();
  });
});
