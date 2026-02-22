import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvitationController } from '../../../../../src/modules/invitations/presentation/invitation.controller';
import { InvitationService } from '../../../../../src/modules/invitations/application/invitation.service';
import { InvitationStatus } from '@shared/types';

const INVITATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('InvitationController', () => {
  let controller: InvitationController;
  let service: jest.Mocked<InvitationService>;

  const mockInvitationService = {
    createInvitation: jest.fn(),
    listInvitations: jest.fn(),
    getInvitationById: jest.fn(),
    revokeInvitation: jest.fn(),
  };

  const createDto = {
    email: 'invitee@example.com',
    name: 'Invitee User',
    role: 'user',
    sectorIds: ['770e8400-e29b-41d4-a716-446655440002'],
  };

  const invitationResponse = {
    id: INVITATION_ID,
    email: 'invitee@example.com',
    name: 'Invitee User',
    role: 'user',
    status: InvitationStatus.PENDING,
    sectors: [{ id: '770e8400-e29b-41d4-a716-446655440002', name: 'HR' }],
    invitedByName: 'Admin User',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    acceptedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const currentUser = {
    userId: USER_ID,
    auth0Id: 'auth0|admin-user',
    permissions: ['users:manage'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
      ],
    }).compile();

    controller = module.get<InvitationController>(InvitationController);
    service = module.get(InvitationService);
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('creates invitation with current user id', async () => {
      service.createInvitation.mockResolvedValue(invitationResponse);

      const result = await controller.createInvitation(createDto, currentUser);

      expect(service.createInvitation).toHaveBeenCalledWith(createDto, USER_ID);
      expect(result).toEqual(invitationResponse);
    });

    it('rethrows service errors', async () => {
      service.createInvitation.mockRejectedValue(new Error('service failure'));

      await expect(
        controller.createInvitation(createDto, currentUser),
      ).rejects.toThrow('service failure');
    });
  });

  describe('listInvitations', () => {
    it('lists invitations by status filter', async () => {
      service.listInvitations.mockResolvedValue([invitationResponse]);

      const result = await controller.listInvitations({
        status: InvitationStatus.PENDING,
      });

      expect(service.listInvitations).toHaveBeenCalledWith(
        InvitationStatus.PENDING,
      );
      expect(result).toHaveLength(1);
    });

    it('rethrows service errors', async () => {
      service.listInvitations.mockRejectedValue(new Error('list failed'));

      await expect(
        controller.listInvitations({ status: InvitationStatus.PENDING }),
      ).rejects.toThrow('list failed');
    });
  });

  describe('getInvitation', () => {
    it('returns invitation when uuid is valid', async () => {
      service.getInvitationById.mockResolvedValue(invitationResponse);

      const result = await controller.getInvitation(INVITATION_ID);

      expect(service.getInvitationById).toHaveBeenCalledWith(INVITATION_ID);
      expect(result.id).toBe(INVITATION_ID);
    });

    it('throws BadRequestException for invalid uuid', async () => {
      await expect(controller.getInvitation('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getInvitationById).not.toHaveBeenCalled();
    });
  });

  describe('revokeInvitation', () => {
    it('revokes invitation when uuid is valid', async () => {
      const revoked = { ...invitationResponse, status: InvitationStatus.REVOKED };
      service.revokeInvitation.mockResolvedValue(revoked);

      const result = await controller.revokeInvitation(INVITATION_ID);

      expect(service.revokeInvitation).toHaveBeenCalledWith(INVITATION_ID);
      expect(result.status).toBe(InvitationStatus.REVOKED);
    });

    it('throws BadRequestException for invalid uuid', async () => {
      await expect(controller.revokeInvitation('bad-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.revokeInvitation).not.toHaveBeenCalled();
    });

    it('rethrows service errors', async () => {
      service.revokeInvitation.mockRejectedValue(new Error('revoke failed'));

      await expect(controller.revokeInvitation(INVITATION_ID)).rejects.toThrow(
        'revoke failed',
      );
    });
  });
});
