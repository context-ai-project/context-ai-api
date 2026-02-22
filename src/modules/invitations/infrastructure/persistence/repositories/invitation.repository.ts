import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InvitationModel } from '../models/invitation.model';
import { SectorModel } from '../../../../sectors/infrastructure/persistence/models/sector.model';
import { InvitationStatus } from '@shared/types';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

/**
 * Invitation Repository
 *
 * Handles persistence operations for Invitation entities.
 */
@Injectable()
export class InvitationRepository {
  private readonly logger = new Logger(InvitationRepository.name);

  constructor(
    @InjectRepository(InvitationModel)
    private readonly repository: Repository<InvitationModel>,
    @InjectRepository(SectorModel)
    private readonly sectorRepository: Repository<SectorModel>,
  ) {}

  /**
   * Load sector models by IDs — used to associate sectors in the ManyToMany
   * relation when saving an invitation. Keeps all TypeORM model access
   * inside the infrastructure layer (not in application services).
   *
   * @param ids - Sector IDs to load
   * @returns Array of SectorModel (may be shorter if some IDs not found)
   */
  async loadSectorModels(ids: string[]): Promise<SectorModel[]> {
    if (ids.length === 0) return [];
    return this.sectorRepository.findBy({ id: In(ids) });
  }

  /**
   * Find pending invitation by email
   */
  async findPendingByEmail(email: string): Promise<InvitationModel | null> {
    return this.repository.findOne({
      where: { email, status: InvitationStatus.PENDING },
      relations: ['sectors'],
    });
  }

  /**
   * Find invitation by ID with relations
   */
  async findById(id: string): Promise<InvitationModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['sectors', 'invitedByUser'],
    });
  }

  /**
   * Find all invitations, optionally filtered by status
   */
  async findAll(status?: InvitationStatus): Promise<InvitationModel[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.sectors', 'sector')
      .leftJoinAndSelect('invitation.invitedByUser', 'invitedByUser')
      .orderBy('invitation.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('invitation.status = :status', { status });
    }

    return queryBuilder.getMany();
  }

  /**
   * Save an invitation (create or update)
   */
  async save(invitation: Partial<InvitationModel>): Promise<InvitationModel> {
    const model = this.repository.create(invitation);
    return this.repository.save(model);
  }

  /**
   * Update invitation fields
   */
  async update(id: string, fields: Partial<InvitationModel>): Promise<void> {
    await this.repository.update(id, fields);
  }

  /**
   * Count pending invitations (for admin stats)
   */
  async countPending(): Promise<number> {
    return this.repository.count({
      where: { status: InvitationStatus.PENDING },
    });
  }

  /**
   * Find expired pending invitations that need to be marked
   */
  async findExpiredPending(): Promise<InvitationModel[]> {
    try {
      return await this.repository
        .createQueryBuilder('invitation')
        .where('invitation.status = :status', {
          status: InvitationStatus.PENDING,
        })
        .andWhere('invitation.expiresAt < NOW()')
        .getMany();
    } catch (error: unknown) {
      this.logger.error(
        `Failed to find expired invitations: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      return [];
    }
  }
}
