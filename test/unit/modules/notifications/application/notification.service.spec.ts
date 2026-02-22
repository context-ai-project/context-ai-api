import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '@modules/notifications/application/notification.service';
import { NotificationRepository } from '@modules/notifications/infrastructure/persistence/repositories/notification.repository';
import { NotificationModel } from '@modules/notifications/infrastructure/persistence/models/notification.model';
import { NotificationType } from '@shared/types';

// Test constants
const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_NOTIFICATION_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: jest.Mocked<NotificationRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findByUserId: jest.fn(),
      countUnread: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get(NotificationRepository);
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const mockNotification: Partial<NotificationModel> = {
        id: MOCK_NOTIFICATION_ID,
        userId: MOCK_USER_ID,
        type: NotificationType.INVITATION_CREATED,
        title: 'Test Notification',
        message: 'Test message',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
      };

      repository.create.mockResolvedValue(
        mockNotification as NotificationModel,
      );

      const result = await service.create({
        userId: MOCK_USER_ID,
        type: NotificationType.INVITATION_CREATED,
        title: 'Test Notification',
        message: 'Test message',
      });

      expect(result.id).toBe(MOCK_NOTIFICATION_ID);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: MOCK_USER_ID,
          type: NotificationType.INVITATION_CREATED,
          title: 'Test Notification',
          message: 'Test message',
          isRead: false,
        }),
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should return formatted notifications', async () => {
      const mockNotifications: Partial<NotificationModel>[] = [
        {
          id: MOCK_NOTIFICATION_ID,
          type: NotificationType.INVITATION_CREATED,
          title: 'Notification 1',
          message: 'Message 1',
          isRead: false,
          metadata: null,
          createdAt: new Date(),
        },
      ];

      repository.findByUserId.mockResolvedValue(
        mockNotifications as NotificationModel[],
      );

      const result = await service.getUserNotifications(MOCK_USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Notification 1');
      expect(result[0].isRead).toBe(false);
    });
  });

  describe('countUnread', () => {
    it('should return unread count', async () => {
      repository.countUnread.mockResolvedValue(3);

      const result = await service.countUnread(MOCK_USER_ID);

      expect(result).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark a single notification as read', async () => {
      await service.markAsRead(MOCK_NOTIFICATION_ID, MOCK_USER_ID);

      expect(repository.markAsRead).toHaveBeenCalledWith(
        MOCK_NOTIFICATION_ID,
        MOCK_USER_ID,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      await service.markAllAsRead(MOCK_USER_ID);

      expect(repository.markAllAsRead).toHaveBeenCalledWith(MOCK_USER_ID);
    });
  });
});

