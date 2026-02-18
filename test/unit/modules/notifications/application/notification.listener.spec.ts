import { Test, TestingModule } from '@nestjs/testing';
import { NotificationListener } from '@modules/notifications/application/listeners/notification.listener';
import { NotificationService } from '@modules/notifications/application/notification.service';
import { UserRepository } from '@modules/users/infrastructure/persistence/repositories/user.repository';
import { InvitationCreatedEvent } from '@modules/invitations/domain/events/invitation.events';
import { UserActivatedEvent } from '@modules/users/domain/events/user.events';
import { NotificationType } from '@shared/types';

// Test constants
const ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const INVITATION_ID = '660e8400-e29b-41d4-a716-446655440001';
const USER_ID = '770e8400-e29b-41d4-a716-446655440002';

describe('NotificationListener', () => {
  let listener: NotificationListener;
  let notificationService: jest.Mocked<NotificationService>;
  let userRepository: jest.Mocked<UserRepository>;

  const mockAdminUsers = [
    {
      id: ADMIN_USER_ID,
      roles: [{ name: 'admin' }],
    },
  ];

  beforeEach(async () => {
    const mockNotificationService = {
      create: jest.fn(),
    };

    const mockUserRepository = {
      findAllWithRelations: jest.fn().mockResolvedValue(mockAdminUsers),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationListener,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    listener = module.get<NotificationListener>(NotificationListener);
    notificationService = module.get(NotificationService);
    userRepository = module.get(UserRepository);
  });

  describe('handleInvitationCreated', () => {
    it('should create notifications for all admins', async () => {
      const event = new InvitationCreatedEvent(
        INVITATION_ID,
        'user@test.com',
        'John Doe',
        'user',
        [],
        USER_ID,
        new Date(),
      );

      await listener.handleInvitationCreated(event);

      expect(userRepository.findAllWithRelations).toHaveBeenCalled();
      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ADMIN_USER_ID,
          type: NotificationType.INVITATION_CREATED,
          title: 'New Invitation Sent',
        }),
      );
    });

    it('should not throw on error', async () => {
      userRepository.findAllWithRelations.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        listener.handleInvitationCreated(
          new InvitationCreatedEvent(
            INVITATION_ID,
            'user@test.com',
            'John Doe',
            'user',
            [],
            USER_ID,
            new Date(),
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleUserActivated', () => {
    it('should create notifications for all admins', async () => {
      const event = new UserActivatedEvent(
        USER_ID,
        'user@test.com',
        'John Doe',
        'auth0|abc',
        new Date(),
      );

      await listener.handleUserActivated(event);

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ADMIN_USER_ID,
          type: NotificationType.USER_ACTIVATED,
          title: 'New User Activated',
        }),
      );
    });
  });
});

