import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvitationRepository } from '../infrastructure/persistence/repositories/invitation.repository';
import { Auth0ManagementService } from '../infrastructure/auth0/auth0-management.service';
import { InvitationModel } from '../infrastructure/persistence/models/invitation.model';
import { UserRepository } from '../../users/infrastructure/persistence/repositories/user.repository';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  InvitationSectorDto,
} from '../presentation/dtos/invitation.dto';
import { InvitationCreatedEvent } from '../domain/events/invitation.events';
import { InvitationStatus } from '@shared/types';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

/** Invitation validity in days */
const INVITATION_EXPIRY_DAYS = 7;

/** Milliseconds per day */
const MS_PER_DAY = 86_400_000;

/**
 * Invitation Service
 *
 * Manages the invitation lifecycle:
 * - Creates invitation + Auth0 user + sends emails
 * - Lists invitations (with optional status filter)
 * - Revokes pending invitations
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly auth0Service: Auth0ManagementService,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new invitation
   *
   * Orchestrates 5 private steps — each throws on failure:
   * 1. Guard duplicate / already-registered
   * 2. Validate sectors
   * 3. Require inviter
   * 4. Provision Auth0 account (create user + send reset email)
   * 5. Persist record + emit domain event
   */
  async createInvitation(
    dto: CreateInvitationDto,
    inviterId: string,
  ): Promise<InvitationResponseDto> {
    this.logger.log(`Creating invitation for: ${dto.email}`);

    await this.assertNoPendingInvitation(dto.email);
    await this.assertNotRegistered(dto.email);

    const sectorIds = dto.sectorIds ?? [];
    const sectors = await this.loadValidatedSectors(sectorIds);
    const inviter = await this.requireInviter(inviterId);
    const role = dto.role ?? 'user';

    const auth0UserId = await this.provisionAuth0Account(dto);

    const invitation = await this.persistInvitationRecord(
      dto,
      inviterId,
      auth0UserId,
      sectors,
      role,
    );

    this.emitInvitationCreatedEvent(invitation, sectorIds, inviterId);

    this.logger.log(`Invitation created: ${invitation.id} for ${dto.email}`);
    return this.toResponseDto(invitation, inviter.name);
  }

  // ==================== createInvitation helpers ====================

  private async assertNoPendingInvitation(email: string): Promise<void> {
    const existing = await this.invitationRepository.findPendingByEmail(email);
    if (existing) {
      throw new ConflictException(
        `A pending invitation already exists for ${email}`,
      );
    }
  }

  private async assertNotRegistered(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (user) {
      throw new ConflictException(
        `A user with email ${email} is already registered`,
      );
    }
  }

  private async loadValidatedSectors(sectorIds: string[]) {
    const sectors = await this.invitationRepository.loadSectorModels(sectorIds);
    if (sectors.length !== sectorIds.length) {
      throw new BadRequestException('One or more sector IDs are invalid');
    }
    return sectors;
  }

  private async requireInviter(inviterId: string) {
    const inviter = await this.userRepository.findById(inviterId);
    if (!inviter) {
      throw new NotFoundException('Inviting user not found');
    }
    return inviter;
  }

  /** Creates Auth0 user + triggers password-reset email. Returns Auth0 userId. */
  private async provisionAuth0Account(
    dto: CreateInvitationDto,
  ): Promise<string> {
    const auth0Result = await this.auth0Service.createUser({
      email: dto.email,
      name: dto.name,
    });
    await this.auth0Service.sendPasswordResetEmail({ email: dto.email });
    return auth0Result.userId;
  }

  private async persistInvitationRecord(
    dto: CreateInvitationDto,
    inviterId: string,
    auth0UserId: string,
    sectors: Awaited<ReturnType<typeof this.loadValidatedSectors>>,
    role: string,
  ): Promise<InvitationModel> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_DAYS * MS_PER_DAY,
    );
    return this.invitationRepository.save({
      email: dto.email,
      name: dto.name,
      role,
      status: InvitationStatus.PENDING,
      token,
      invitedBy: inviterId,
      auth0UserId,
      sectors,
      expiresAt,
      acceptedAt: null,
    });
  }

  private emitInvitationCreatedEvent(
    invitation: InvitationModel,
    sectorIds: string[],
    inviterId: string,
  ): void {
    this.eventEmitter.emit(
      'invitation.created',
      new InvitationCreatedEvent(
        invitation.id,
        invitation.email,
        invitation.name,
        invitation.role,
        sectorIds,
        inviterId,
        invitation.createdAt,
      ),
    );
  }

  /**
   * List all invitations, optionally filtered by status
   */
  async listInvitations(
    status?: InvitationStatus,
  ): Promise<InvitationResponseDto[]> {
    const invitations = await this.invitationRepository.findAll(status);

    return invitations.map((inv) =>
      this.toResponseDto(inv, inv.invitedByUser?.name ?? 'Unknown'),
    );
  }

  /**
   * Get a single invitation by ID
   */
  async getInvitationById(id: string): Promise<InvitationResponseDto> {
    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation ${id} not found`);
    }

    return this.toResponseDto(
      invitation,
      invitation.invitedByUser?.name ?? 'Unknown',
    );
  }

  /**
   * Revoke a pending invitation
   */
  async revokeInvitation(id: string): Promise<InvitationResponseDto> {
    const invitation = await this.invitationRepository.findById(id);
    if (!invitation) {
      throw new NotFoundException(`Invitation ${id} not found`);
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot revoke invitation with status: ${invitation.status}`,
      );
    }

    await this.invitationRepository.update(id, {
      status: InvitationStatus.REVOKED,
    });

    const updated = await this.invitationRepository.findById(id);
    if (!updated) {
      throw new NotFoundException(`Invitation ${id} not found after update`);
    }

    this.logger.log(`Invitation revoked: ${id}`);

    return this.toResponseDto(
      updated,
      updated.invitedByUser?.name ?? 'Unknown',
    );
  }

  /**
   * Count pending invitations (for admin stats)
   */
  async countPending(): Promise<number> {
    return this.invitationRepository.countPending();
  }

  /**
   * Find pending invitation by email (used during user sync)
   */
  async findPendingByEmail(email: string): Promise<InvitationModel | null> {
    try {
      return await this.invitationRepository.findPendingByEmail(email);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to find pending invitation for ${email}: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      return null;
    }
  }

  /**
   * Mark an invitation as accepted
   */
  async markAccepted(id: string): Promise<void> {
    await this.invitationRepository.update(id, {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    this.logger.log(`Invitation marked as accepted: ${id}`);
  }

  // ==================== Private Helpers ====================

  private toResponseDto(
    model: InvitationModel,
    invitedByName: string,
  ): InvitationResponseDto {
    const sectors: InvitationSectorDto[] = (model.sectors ?? []).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    return {
      id: model.id,
      email: model.email,
      name: model.name,
      role: model.role,
      status: model.status,
      sectors,
      invitedByName,
      expiresAt: model.expiresAt,
      acceptedAt: model.acceptedAt,
      createdAt: model.createdAt,
    };
  }
}
