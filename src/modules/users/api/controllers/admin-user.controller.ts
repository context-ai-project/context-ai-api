import {
  Controller,
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
  ApiQuery,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminUserService } from '../../application/services/admin-user.service';
import {
  UpdateUserRoleDto,
  ToggleUserStatusDto,
  UpdateUserSectorsDto,
  AdminUserResponseDto,
  AdminUserQueryDto,
} from '../../application/dtos/admin-user.dto';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { isValidUUID } from '@shared/validators';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

// API description constants
const API_AUTH_DESC = 'Authentication required - Missing or invalid JWT token';
const API_FORBIDDEN_DESC =
  'Access denied - Requires users:manage permission (admin role)';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/** Required permission for all admin user endpoints */
const ADMIN_PERMISSION: [string] = ['users:manage'];

/** Swagger descriptions reused across endpoints */
const USER_UUID_DESC = 'User UUID';
const USER_NOT_FOUND_DESC = 'User not found';

/**
 * Admin User Controller
 *
 * Handles HTTP requests for administrative user management.
 * All endpoints require the `users:manage` permission (admin role only).
 *
 * RBAC Matrix (016-rbac-permissions-matrix):
 * - `users:manage` → admin only
 * - `system:admin` → admin only
 *
 * Endpoints:
 * - GET    /admin/users           → List all users (with optional search)
 * - GET    /admin/users/:id       → Get user by ID
 * - PATCH  /admin/users/:id/role  → Update user role
 * - PATCH  /admin/users/:id/status → Toggle user active/inactive
 * - PATCH  /admin/users/:id/sectors → Update user-sector associations
 */
@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUserController {
  private readonly logger = new Logger(AdminUserController.name);

  constructor(private readonly adminUserService: AdminUserService) {}

  // ==================== LIST ALL USERS ====================

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'List all users (admin)',
    description:
      'Returns all users with roles and sector assignments. ' +
      'Supports optional search by name or email.\n\n**Required Permission:** users:manage',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email (case-insensitive)',
    example: 'john',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [AdminUserResponseDto],
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async listUsers(
    @Query() query: AdminUserQueryDto,
  ): Promise<AdminUserResponseDto[]> {
    const searchSuffix = query.search
      ? ' with search: "' + query.search + '"'
      : '';
    this.logger.log('List users request' + searchSuffix);

    try {
      return await this.adminUserService.listUsers(query.search);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to list users: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== GET USER BY ID ====================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Get user by ID (admin)',
    description:
      'Returns a single user with roles and sectors.\n\n**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: USER_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'User detail',
    type: AdminUserResponseDto,
  })
  @ApiResponse({ status: 404, description: USER_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async getUser(@Param('id') id: string): Promise<AdminUserResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Get user: ${id}`);

    try {
      return await this.adminUserService.getUserById(id);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== UPDATE USER ROLE ====================

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Update user role (admin)',
    description:
      'Changes the role assigned to a user.\n\n**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: USER_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Role updated',
    type: AdminUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid role' })
  @ApiResponse({ status: 404, description: USER_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<AdminUserResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Update role for user ${id} to ${dto.role}`);

    try {
      return await this.adminUserService.updateUserRole(id, dto.role);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update user role: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== TOGGLE USER STATUS ====================

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Toggle user active/inactive status (admin)',
    description:
      'Activates or deactivates a user. Inactive users cannot access the application.\n\n**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: USER_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: AdminUserResponseDto,
  })
  @ApiResponse({ status: 404, description: USER_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleUserStatusDto,
  ): Promise<AdminUserResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(
      `Toggle status for user ${id} to ${dto.isActive ? 'active' : 'inactive'}`,
    );

    try {
      return await this.adminUserService.toggleUserStatus(id, dto.isActive);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to toggle user status: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== UPDATE USER SECTORS ====================

  @Patch(':id/sectors')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(ADMIN_PERMISSION)
  @ApiOperation({
    summary: 'Update user-sector associations (admin)',
    description:
      'Replaces all sector assignments for a user.\n\n**Required Permission:** users:manage',
  })
  @ApiParam({
    name: 'id',
    description: USER_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Sectors updated',
    type: AdminUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid sector ID' })
  @ApiResponse({ status: 404, description: USER_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async updateSectors(
    @Param('id') id: string,
    @Body() dto: UpdateUserSectorsDto,
  ): Promise<AdminUserResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Update sectors for user ${id}`);

    try {
      return await this.adminUserService.updateUserSectors(id, dto.sectorIds);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update user sectors: ${extractErrorMessage(error)}`,
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
