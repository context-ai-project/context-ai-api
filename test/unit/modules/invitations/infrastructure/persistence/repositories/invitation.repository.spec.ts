import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationRepository } from '../../../../../../../src/modules/invitations/infrastructure/persistence/repositories/invitation.repository';
import { InvitationModel } from '../../../../../../../src/modules/invitations/infrastructure/persistence/models/invitation.model';
import { SectorModel } from '../../../../../../../src/modules/sectors/infrastructure/persistence/models/sector.model';
import { InvitationStatus } from '@shared/types';

const INVITATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const SECTOR_ID_1 = '660e8400-e29b-41d4-a716-446655440001';
const SECTOR_ID_2 = '770e8400-e29b-41d4-a716-446655440002';

function createInvitationModel(
  overrides?: Partial<InvitationModel>,
): InvitationModel {
  const model = new InvitationModel();
  model.id = INVITATION_ID;
  model.email = 'test@example.com';
  model.name = 'Test User';
  model.role = 'user';
  model.status = InvitationStatus.PENDING;
  model.token = 'token-123';
  model.invitedBy = 'admin-id';
  model.expiresAt = new Date('2026-12-31T00:00:00Z');
  model.createdAt = new Date('2026-01-01T00:00:00Z');
  model.updatedAt = new Date('2026-01-01T00:00:00Z');
  Object.assign(model, overrides);
  return model;
}

describe('InvitationRepository', () => {
  let repository: InvitationRepository;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockInvitationRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockSectorRepo = {
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationRepository,
        {
          provide: getRepositoryToken(InvitationModel),
          useValue: mockInvitationRepo,
        },
        {
          provide: getRepositoryToken(SectorModel),
          useValue: mockSectorRepo,
        },
      ],
    }).compile();

    repository = module.get<InvitationRepository>(InvitationRepository);
    jest.clearAllMocks();
    mockInvitationRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('loadSectorModels', () => {
    it('should return empty array for empty ids', async () => {
      const result = await repository.loadSectorModels([]);
      expect(result).toEqual([]);
      expect(mockSectorRepo.findBy).not.toHaveBeenCalled();
    });

    it('should return sector models for given ids', async () => {
      const sectors = [{ id: SECTOR_ID_1 }, { id: SECTOR_ID_2 }];
      mockSectorRepo.findBy.mockResolvedValue(sectors);

      const result = await repository.loadSectorModels([
        SECTOR_ID_1,
        SECTOR_ID_2,
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe('findPendingByEmail', () => {
    it('should return pending invitation by email', async () => {
      const model = createInvitationModel();
      mockInvitationRepo.findOne.mockResolvedValue(model);

      const result = await repository.findPendingByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(mockInvitationRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', status: InvitationStatus.PENDING },
        relations: ['sectors'],
      });
    });

    it('should return null when no pending invitation found', async () => {
      mockInvitationRepo.findOne.mockResolvedValue(null);

      const result = await repository.findPendingByEmail('no@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return invitation with relations', async () => {
      mockInvitationRepo.findOne.mockResolvedValue(createInvitationModel());

      const result = await repository.findById(INVITATION_ID);

      expect(result).toBeDefined();
      expect(mockInvitationRepo.findOne).toHaveBeenCalledWith({
        where: { id: INVITATION_ID },
        relations: ['sectors', 'invitedByUser'],
      });
    });
  });

  describe('findAll', () => {
    it('should return all invitations without status filter', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([createInvitationModel()]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('should apply status filter when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findAll(InvitationStatus.PENDING);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'invitation.status = :status',
        { status: InvitationStatus.PENDING },
      );
    });
  });

  describe('save', () => {
    it('should create and save invitation', async () => {
      const model = createInvitationModel();
      mockInvitationRepo.create.mockReturnValue(model);
      mockInvitationRepo.save.mockResolvedValue(model);

      const result = await repository.save({ email: 'test@example.com' });

      expect(result).toBeDefined();
      expect(mockInvitationRepo.create).toHaveBeenCalled();
      expect(mockInvitationRepo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update invitation fields', async () => {
      await repository.update(INVITATION_ID, {
        status: InvitationStatus.ACCEPTED,
      });

      expect(mockInvitationRepo.update).toHaveBeenCalledWith(INVITATION_ID, {
        status: InvitationStatus.ACCEPTED,
      });
    });
  });

  describe('countPending', () => {
    it('should return count of pending invitations', async () => {
      mockInvitationRepo.count.mockResolvedValue(3);

      const result = await repository.countPending();

      expect(result).toBe(3);
    });
  });

  describe('findExpiredPending', () => {
    it('should return expired pending invitations', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([createInvitationModel()]);

      const result = await repository.findExpiredPending();

      expect(result).toHaveLength(1);
    });

    it('should return empty array on error', async () => {
      mockInvitationRepo.createQueryBuilder.mockReturnValue({
        ...mockQueryBuilder,
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockImplementation(() => {
          throw new Error('DB error');
        }),
      });

      const result = await repository.findExpiredPending();

      expect(result).toEqual([]);
    });
  });
});
