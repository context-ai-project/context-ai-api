import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvitationService } from '../application/invitation.service';
import {
  CreateInvitationDto,
  InvitationResponseDto,
  ListInvitationsQueryDto,
} from './dtos/invitation.dto';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ValidatedUser } from '../../auth/types/jwt-payload.type';
import { isValidUUID } from '@shared/validators';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

// API description constants
const API_AUTH_DESC = 'Authentication required';
const API_FORBIDDEN_DESC = 'Access denied — requires users:manage permission';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/** Required permission for invitation management */
const ADMIN_PERMISSION: [string] = ['users:manage'];

/**
 * Invitation Controller
 *
 * Endpoints for managing user invitations (admin only):
 * - POST   /admin/invitations       → Create invitation
 * - GET    /admin/invitations       → List invitations
 * - GET    /admin/invitations/:id   → Get invitation by ID
 * - PATCH  /admin/invitations/:id/revoke → Revoke invitation
 */
@ApiTags('Admin - Invitations')
@ApiBearerAuth()
@Controller('admin/invitations')
export class InvitationController {
  private readonly logger = new Logger(InvitationController.name);

  constructor(private readonly invitationService: InvitationService) {}

  // ==================== CREATE INVITATION ====================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Send an invitation to a new user',
    description:
      'Creates an Auth0 account, sends password-reset and welcome emails, ' +
      'and records the invitation.\n\n**Required Permission:** users:manage',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already invited or registered',
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async createInvitation(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<InvitationResponseDto> {
    this.logger.log(`Create invitation request for: ${dto.email}`);

    try {
      return await this.invitationService.createInvitation(dto, user.userId);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create invitation: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== LIST INVITATIONS ====================

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'List all invitations',
    description:
      'Returns all invitations with optional status filter.\n\n**Required Permission:** users:manage',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invitations',
    type: [InvitationResponseDto],
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async listInvitations(
    @Query() query: ListInvitationsQueryDto,
  ): Promise<InvitationResponseDto[]> {
    this.logger.log('List invitations request');

    try {
      return await this.invitationService.listInvitations(query.status);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to list invitations: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== GET INVITATION BY ID ====================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Get invitation by ID',
    description:
      'Returns a single invitation.\n\n**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation UUID',
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation detail',
    type: InvitationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async getInvitation(@Param('id') id: string): Promise<InvitationResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Get invitation: ${id}`);

    try {
      return await this.invitationService.getInvitationById(id);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get invitation: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== REVOKE INVITATION ====================

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Revoke a pending invitation',
    description:
      'Revokes a pending invitation. Only PENDING invitations can be revoked.\n\n' +
      '**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation UUID',
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation revoked',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot revoke non-pending invitation',
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async revokeInvitation(
    @Param('id') id: string,
  ): Promise<InvitationResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Revoke invitation: ${id}`);

    try {
      return await this.invitationService.revokeInvitation(id);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to revoke invitation: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== Private Helpers ====================

  private validateUUID(value: string, fieldName: string): void {
    if (!isValidUUID(value)) {
      throw new BadRequestException(`${fieldName} must be a valid UUID`);
    }
  }
}
