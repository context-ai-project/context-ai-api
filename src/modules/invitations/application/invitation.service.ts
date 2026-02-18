import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InvitationRepository } from '../infrastructure/persistence/repositories/invitation.repository';
import { Auth0ManagementService } from '../infrastructure/auth0/auth0-management.service';
import { EmailService } from '../infrastructure/email/email.service';
import { InvitationModel } from '../infrastructure/persistence/models/invitation.model';
import { SectorModel } from '../../sectors/infrastructure/persistence/models/sector.model';
import { UserRepository } from '../../users/infrastructure/persistence/repositories/user.repository';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  InvitationSectorDto,
} from '../presentation/dtos/invitation.dto';
import { InvitationCreatedEvent } from '../domain/events/invitation.events';
import { InvitationStatus } from '@shared/types';
import { ConfigService } from '@nestjs/config';
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
    private readonly emailService: EmailService,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @InjectRepository(SectorModel)
    private readonly sectorRepository: Repository<SectorModel>,
  ) {}

  /**
   * Create a new invitation
   *
   * Steps:
   * 1. Validate email is not already invited/registered
   * 2. Validate sector IDs
   * 3. Create Auth0 user
   * 4. Generate password-change ticket (Auth0 sends email)
   * 5. Send welcome email (Resend)
   * 6. Persist invitation
   * 7. Emit InvitationCreatedEvent
   */
  async createInvitation(
    dto: CreateInvitationDto,
    inviterId: string,
  ): Promise<InvitationResponseDto> {
    this.logger.log(`Creating invitation for: ${dto.email}`);

    // 1. Check duplicate invitation
    const existingInvitation =
      await this.invitationRepository.findPendingByEmail(dto.email);
    if (existingInvitation) {
      throw new ConflictException(
        `A pending invitation already exists for ${dto.email}`,
      );
    }

    // 2. Check if user already registered
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        `A user with email ${dto.email} is already registered`,
      );
    }

    // 3. Validate sectors
    const sectorIds = dto.sectorIds ?? [];
    let sectors: SectorModel[] = [];
    if (sectorIds.length > 0) {
      sectors = await this.sectorRepository.findBy({ id: In(sectorIds) });
      if (sectors.length !== sectorIds.length) {
        throw new BadRequestException('One or more sector IDs are invalid');
      }
    }

    // 4. Get inviter name
    const inviter = await this.userRepository.findById(inviterId);
    if (!inviter) {
      throw new NotFoundException('Inviting user not found');
    }

    // 5. Create Auth0 user
    const role = dto.role ?? 'user';
    const auth0Result = await this.auth0Service.createUser({
      email: dto.email,
      name: dto.name,
    });

    // 6. Generate password-change ticket (Auth0 sends email)
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    await this.auth0Service.createPasswordChangeTicket({
      userId: auth0Result.userId,
      resultUrl: `${frontendUrl}/auth/login`,
    });

    // 7. Send welcome email via Resend (non-blocking, doesn't throw)
    const sectorNames = sectors.map((s) => s.name);
    await this.emailService.sendInvitationEmail({
      to: dto.email,
      inviteeName: dto.name,
      role,
      sectorNames,
      invitedByName: inviter.name,
    });

    // 8. Persist invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_DAYS * MS_PER_DAY,
    );

    const invitation = await this.invitationRepository.save({
      email: dto.email,
      name: dto.name,
      role,
      status: InvitationStatus.PENDING,
      token,
      invitedBy: inviterId,
      auth0UserId: auth0Result.userId,
      sectors,
      expiresAt,
      acceptedAt: null,
    });

    // 9. Emit event for notifications
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

    this.logger.log(`Invitation created: ${invitation.id} for ${dto.email}`);

    return this.toResponseDto(invitation, inviter.name);
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
