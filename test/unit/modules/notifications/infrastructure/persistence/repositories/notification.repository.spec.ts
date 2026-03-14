import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationRepository } from '../../../../../../../src/modules/notifications/infrastructure/persistence/repositories/notification.repository';
import { NotificationModel } from '../../../../../../../src/modules/notifications/infrastructure/persistence/models/notification.model';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOTIFICATION_ID = '660e8400-e29b-41d4-a716-446655440001';

function createNotificationModel(
  overrides?: Partial<NotificationModel>,
): Partial<NotificationModel> {
  return {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('NotificationRepository', () => {
  let repository: NotificationRepository;

  const mockTypeOrmRepo = {
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRepository,
        {
          provide: getRepositoryToken(NotificationModel),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<NotificationRepository>(NotificationRepository);
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('should return notifications with default limit', async () => {
      const models = [createNotificationModel()];
      mockTypeOrmRepo.find.mockResolvedValue(models);

      const result = await repository.findByUserId(USER_ID);

      expect(result).toHaveLength(1);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { createdAt: 'DESC' },
        take: 20,
      });
    });

    it('should apply custom limit', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repository.findByUserId(USER_ID, 5);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('countUnread', () => {
    it('should return count of unread notifications', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(7);

      const result = await repository.countUnread(USER_ID);

      expect(result).toBe(7);
      expect(mockTypeOrmRepo.count).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark a single notification as read', async () => {
      await repository.markAsRead(NOTIFICATION_ID, USER_ID);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: NOTIFICATION_ID, userId: USER_ID },
        { isRead: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a user', async () => {
      await repository.markAllAsRead(USER_ID);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID, isRead: false },
        { isRead: true },
      );
    });
  });

  describe('create', () => {
    it('should create and save a notification', async () => {
      const model = createNotificationModel();
      mockTypeOrmRepo.create.mockReturnValue(model);
      mockTypeOrmRepo.save.mockResolvedValue(model);

      const result = await repository.create({ userId: USER_ID });

      expect(result).toBeDefined();
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({ userId: USER_ID });
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(model);
    });
  });
});
