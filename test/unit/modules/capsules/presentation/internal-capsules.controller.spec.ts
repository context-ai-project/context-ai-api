import { InternalCapsulesController } from '../../../../../src/modules/capsules/presentation/internal-capsules.controller';

describe('InternalCapsulesController', () => {
  let controller: InternalCapsulesController;
  const mockPipeline = { processVideo: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InternalCapsulesController(mockPipeline as never);
  });

  describe('POST /internal/capsules/:id/process-video', () => {
    it('calls VideoPipelineService.processVideo and returns 200', async () => {
      mockPipeline.processVideo.mockResolvedValue(undefined);

      const result = await controller.processVideo('cap-1', {
        voiceId: 'voice-maria',
      });

      expect(mockPipeline.processVideo).toHaveBeenCalledWith(
        'cap-1',
        'voice-maria',
      );
      expect(result).toEqual({ status: 'completed' });
    });

    it('propagates errors from the pipeline', async () => {
      mockPipeline.processVideo.mockRejectedValue(
        new Error('Pipeline error'),
      );

      await expect(
        controller.processVideo('cap-1', { voiceId: 'v' }),
      ).rejects.toThrow('Pipeline error');
    });
  });
});
