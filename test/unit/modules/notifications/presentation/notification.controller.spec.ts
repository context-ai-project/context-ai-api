import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotificationController } from '../../../../../src/modules/notifications/presentation/notification.controller';
import { NotificationService } from '../../../../../src/modules/notifications/application/notification.service';
import { NotificationType } from '@shared/types';

const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: jest.Mocked<NotificationService>;

  const mockNotificationService = {
    create: jest.fn(),
    getUserNotifications: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };
  const currentUser = {
    userId: USER_ID,
    auth0Id: 'auth0|user',
    permissions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get(NotificationService);
    jest.clearAllMocks();
  });

  describe('listNotifications', () => {
    it('returns notifications for current user', async () => {
      const notifications = [
        {
          id: NOTIFICATION_ID,
          type: NotificationType.INVITATION_CREATED,
          title: 'New Invitation Sent',
          message: 'An invitation was sent.',
          metadata: {},
          isRead: false,
          createdAt: new Date(),
        },
      ];
      service.getUserNotifications.mockResolvedValue(notifications);

      const result = await controller.listNotifications({
        ...currentUser,
      });

      expect(service.getUserNotifications).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(notifications);
    });

    it('rethrows service errors', async () => {
      service.getUserNotifications.mockRejectedValue(new Error('list failed'));

      await expect(
        controller.listNotifications(currentUser),
      ).rejects.toThrow('list failed');
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count for current user', async () => {
      service.countUnread.mockResolvedValue(3);

      const result = await controller.getUnreadCount({
        ...currentUser,
      });

      expect(service.countUnread).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ count: 3 });
    });

    it('rethrows service errors', async () => {
      service.countUnread.mockRejectedValue(new Error('count failed'));

      await expect(
        controller.getUnreadCount(currentUser),
      ).rejects.toThrow('count failed');
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read and returns success', async () => {
      service.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead(
        NOTIFICATION_ID,
        currentUser,
      );

      expect(service.markAsRead).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID);
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException for invalid uuid', async () => {
      await expect(
        controller.markAsRead('invalid', currentUser),
      ).rejects.toThrow(BadRequestException);
      expect(service.markAsRead).not.toHaveBeenCalled();
    });

    it('rethrows service errors', async () => {
      service.markAsRead.mockRejectedValue(new Error('mark failed'));

      await expect(
        controller.markAsRead(
          NOTIFICATION_ID,
          currentUser,
        ),
      ).rejects.toThrow('mark failed');
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read and returns success', async () => {
      service.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead({
        ...currentUser,
      });

      expect(service.markAllAsRead).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ success: true });
    });

    it('rethrows service errors', async () => {
      service.markAllAsRead.mockRejectedValue(new Error('mark-all failed'));

      await expect(
        controller.markAllAsRead(currentUser),
      ).rejects.toThrow('mark-all failed');
    });
  });
});
