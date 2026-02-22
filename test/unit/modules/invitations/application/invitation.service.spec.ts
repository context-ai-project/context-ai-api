import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvitationService } from '@modules/invitations/application/invitation.service';
import { InvitationRepository } from '@modules/invitations/infrastructure/persistence/repositories/invitation.repository';
import { Auth0ManagementService } from '@modules/invitations/infrastructure/auth0/auth0-management.service';
import { InvitationModel } from '@modules/invitations/infrastructure/persistence/models/invitation.model';
import { SectorModel } from '@modules/sectors/infrastructure/persistence/models/sector.model';
import { UserRepository } from '@modules/users/infrastructure/persistence/repositories/user.repository';
import { User } from '@modules/users/domain/entities/user.entity';
import { InvitationStatus } from '@shared/types';
import { InvitationCreatedEvent } from '@modules/invitations/domain/events/invitation.events';

// Test constants
const MOCK_INVITER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_INVITATION_ID = '660e8400-e29b-41d4-a716-446655440001';
const MOCK_EMAIL = 'user@example.com';
const MOCK_NAME = 'John Doe';
const MOCK_AUTH0_USER_ID = 'auth0|abc123';
const MOCK_SECTOR_ID = '770e8400-e29b-41d4-a716-446655440002';

describe('InvitationService', () => {
  let service: InvitationService;
  let invitationRepository: jest.Mocked<InvitationRepository>;
  let auth0Service: jest.Mocked<Auth0ManagementService>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockInvitationRepository = {
      findPendingByEmail: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      loadSectorModels: jest.fn(),
      countPending: jest.fn(),
      findExpiredPending: jest.fn(),
    };

    const mockAuth0Service = {
      createUser: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: InvitationRepository,
          useValue: mockInvitationRepository,
        },
        { provide: Auth0ManagementService, useValue: mockAuth0Service },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
    invitationRepository = module.get(InvitationRepository);
    auth0Service = module.get(Auth0ManagementService);
    userRepository = module.get(UserRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('createInvitation', () => {
    const createDto = {
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      role: 'user',
      sectorIds: [MOCK_SECTOR_ID],
    };

    const mockInviter = new User({
      id: MOCK_INVITER_ID,
      auth0UserId: 'auth0|inviter',
      email: 'admin@example.com',
      name: 'Admin User',
    });

    const mockSector: Partial<SectorModel> = {
      id: MOCK_SECTOR_ID,
      name: 'Test Sector',
    };

    const mockSavedInvitation: Partial<InvitationModel> = {
      id: MOCK_INVITATION_ID,
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      role: 'user',
      status: InvitationStatus.PENDING,
      token: 'mock-token',
      invitedBy: MOCK_INVITER_ID,
      auth0UserId: MOCK_AUTH0_USER_ID,
      sectors: [mockSector as SectorModel],
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      acceptedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create an invitation successfully', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      invitationRepository.loadSectorModels.mockResolvedValue([mockSector]);
      userRepository.findById.mockResolvedValue(mockInviter);
      auth0Service.createUser.mockResolvedValue({
        userId: MOCK_AUTH0_USER_ID,
      });
      auth0Service.sendPasswordResetEmail.mockResolvedValue(undefined);
      invitationRepository.save.mockResolvedValue(
        mockSavedInvitation as InvitationModel,
      );

      const result = await service.createInvitation(
        createDto,
        MOCK_INVITER_ID,
      );

      expect(result.email).toBe(MOCK_EMAIL);
      expect(result.name).toBe(MOCK_NAME);
      expect(result.role).toBe('user');
      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(result.sectors).toHaveLength(1);
      expect(result.invitedByName).toBe('Admin User');

      // Verify Auth0 integration
      expect(auth0Service.createUser).toHaveBeenCalledWith({
        email: MOCK_EMAIL,
        name: MOCK_NAME,
      });

      // Verify password reset email sent
      expect(auth0Service.sendPasswordResetEmail).toHaveBeenCalledWith({
        email: MOCK_EMAIL,
      });

      // Verify event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'invitation.created',
        expect.any(InvitationCreatedEvent),
      );
    });

    it('should throw ConflictException if invitation already exists', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue(
        mockSavedInvitation as InvitationModel,
      );

      await expect(
        service.createInvitation(createDto, MOCK_INVITER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if user already registered', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(mockInviter);

      await expect(
        service.createInvitation(createDto, MOCK_INVITER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid sector IDs', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      invitationRepository.loadSectorModels.mockResolvedValue([]); // No matching sectors

      await expect(
        service.createInvitation(createDto, MOCK_INVITER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inviter not found', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue(null);
      userRepository.findByEmail.mockResolvedValue(null);
      invitationRepository.loadSectorModels.mockResolvedValue([mockSector]);
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.createInvitation(createDto, MOCK_INVITER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listInvitations', () => {
    it('should return all invitations when no status filter', async () => {
      const mockInvitations = [
        {
          id: MOCK_INVITATION_ID,
          email: MOCK_EMAIL,
          name: MOCK_NAME,
          role: 'user',
          status: InvitationStatus.PENDING,
          sectors: [],
          invitedByUser: { name: 'Admin' },
          expiresAt: new Date(),
          acceptedAt: null,
          createdAt: new Date(),
        },
      ];

      invitationRepository.findAll.mockResolvedValue(
        mockInvitations as unknown as InvitationModel[],
      );

      const result = await service.listInvitations();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe(MOCK_EMAIL);
      expect(invitationRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter by status', async () => {
      invitationRepository.findAll.mockResolvedValue([]);

      await service.listInvitations(InvitationStatus.ACCEPTED);

      expect(invitationRepository.findAll).toHaveBeenCalledWith(
        InvitationStatus.ACCEPTED,
      );
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke a pending invitation', async () => {
      const mockInvitation = {
        id: MOCK_INVITATION_ID,
        email: MOCK_EMAIL,
        name: MOCK_NAME,
        role: 'user',
        status: InvitationStatus.PENDING,
        sectors: [],
        invitedByUser: { name: 'Admin' },
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date(),
      };

      const revokedInvitation = {
        ...mockInvitation,
        status: InvitationStatus.REVOKED,
      };

      invitationRepository.findById
        .mockResolvedValueOnce(mockInvitation as unknown as InvitationModel)
        .mockResolvedValueOnce(
          revokedInvitation as unknown as InvitationModel,
        );

      const result = await service.revokeInvitation(MOCK_INVITATION_ID);

      expect(result.status).toBe(InvitationStatus.REVOKED);
      expect(invitationRepository.update).toHaveBeenCalledWith(
        MOCK_INVITATION_ID,
        { status: InvitationStatus.REVOKED },
      );
    });

    it('should throw BadRequestException for non-pending invitation', async () => {
      const mockInvitation = {
        id: MOCK_INVITATION_ID,
        status: InvitationStatus.ACCEPTED,
      };

      invitationRepository.findById.mockResolvedValue(
        mockInvitation as InvitationModel,
      );

      await expect(
        service.revokeInvitation(MOCK_INVITATION_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if invitation not found', async () => {
      invitationRepository.findById.mockResolvedValue(null);

      await expect(
        service.revokeInvitation(MOCK_INVITATION_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('countPending', () => {
    it('should return pending count', async () => {
      invitationRepository.countPending.mockResolvedValue(5);

      const result = await service.countPending();

      expect(result).toBe(5);
    });
  });

  describe('markAccepted', () => {
    it('should update invitation status to accepted', async () => {
      await service.markAccepted(MOCK_INVITATION_ID);

      expect(invitationRepository.update).toHaveBeenCalledWith(
        MOCK_INVITATION_ID,
        expect.objectContaining({
          status: InvitationStatus.ACCEPTED,
        }),
      );
    });
  });
});

