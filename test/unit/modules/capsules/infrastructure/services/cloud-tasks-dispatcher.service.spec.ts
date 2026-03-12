const mockCreateTask = jest.fn();

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
    queuePath: jest.fn().mockReturnValue('projects/p/locations/l/queues/q'),
  })),
}));

import { CloudTasksDispatcher } from '../../../../../../src/modules/capsules/infrastructure/services/cloud-tasks-dispatcher.service';

describe('CloudTasksDispatcher', () => {
  let dispatcher: CloudTasksDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCS_PROJECT_ID = 'my-project';
    process.env.GCP_LOCATION = 'us-central1';
    process.env.CLOUD_TASKS_QUEUE = 'capsule-video-pipeline';
    process.env.CLOUD_RUN_SERVICE_URL = 'https://api.example.com';
    process.env.INTERNAL_API_KEY = 'test-internal-key';
    dispatcher = new CloudTasksDispatcher();
  });

  afterEach(() => {
    delete process.env.GCS_PROJECT_ID;
    delete process.env.GCP_LOCATION;
    delete process.env.CLOUD_TASKS_QUEUE;
    delete process.env.CLOUD_RUN_SERVICE_URL;
    delete process.env.INTERNAL_API_KEY;
  });

  it('creates a Cloud Task with correct URL and headers', async () => {
    mockCreateTask.mockResolvedValue([{ name: 'tasks/123' }]);

    await dispatcher.dispatchVideoGeneration({
      capsuleId: 'cap-1',
      voiceId: 'voice-maria',
    });

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    const call = mockCreateTask.mock.calls[0][0];
    const httpRequest = call.task.httpRequest;

    expect(httpRequest.url).toBe(
      'https://api.example.com/api/v1/internal/capsules/cap-1/process-video',
    );
    expect(httpRequest.httpMethod).toBe('POST');
    expect(httpRequest.headers['x-internal-api-key']).toBe('test-internal-key');
    expect(httpRequest.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(
      Buffer.from(httpRequest.body, 'base64').toString(),
    );
    expect(body.voiceId).toBe('voice-maria');
  });

  it('throws when task creation fails', async () => {
    mockCreateTask.mockRejectedValue(new Error('GCP error'));

    await expect(
      dispatcher.dispatchVideoGeneration({
        capsuleId: 'cap-1',
        voiceId: 'voice-1',
      }),
    ).rejects.toThrow('Failed to dispatch video generation task');
  });
});
