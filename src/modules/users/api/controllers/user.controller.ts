import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserService } from '../../application/services/user.service';
import type {
  SyncUserDto,
  UserResponseDto,
} from '../../application/services/user.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../../auth/guards/rbac.guard';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { ValidatedUser } from '../../../auth/types/jwt-payload.type';

/**
 * User Controller
 *
 * Handles HTTP requests for user management.
 *
 * Endpoints:
 * - POST /users/sync: Sync user from Auth0 (admin only)
 * - GET /users/profile: Get current user profile
 *
 * Authorization:
 * - All endpoints require JWT authentication
 * - Sync endpoint requires 'users:manage' permission (admin only)
 * - Profile endpoint requires 'profile:read' permission
 *
 * Note: User sync happens automatically during login via JwtStrategy.
 * The /sync endpoint is for administrative/testing purposes only.
 */
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RBACGuard)
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Sync user from Auth0 (Admin only)
   *
   * Creates a new user or updates existing user's last login timestamp.
   *
   * **Note**: This endpoint is for administrative/testing purposes only.
   * User sync happens automatically during login via JwtStrategy.
   *
   * @param dto - User data from Auth0 (sub, email, name)
   * @returns User with internal UUID
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users:manage'])
  @ApiOperation({
    summary: 'Sync user from Auth0 (Admin only)',
    description:
      'Manually sync a user from Auth0. Creates a new user or updates last login timestamp. ' +
      'This endpoint is for administrative purposes only. ' +
      'User sync happens automatically during login. ' +
      '\n\n**Required Permission:** users:manage',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User synced successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Missing or invalid JWT token',
  })
  @ApiForbiddenResponse({
    description: 'Access denied - Requires users:manage permission',
  })
  async syncUser(@Body() dto: SyncUserDto): Promise<UserResponseDto> {
    this.logger.log(`Manual sync user request: ${dto.auth0UserId}`);
    return this.userService.syncUser(dto);
  }

  /**
   * Get current user profile
   *
   * Returns the authenticated user's profile information.
   *
   * @param user - Current authenticated user
   * @returns User profile
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['profile:read'])
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieve the authenticated user profile information. ' +
      '\n\n**Required Permission:** profile:read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Missing or invalid JWT token',
  })
  @ApiForbiddenResponse({
    description: 'Access denied - Requires profile:read permission',
  })
  async getProfile(
    @CurrentUser() user: ValidatedUser,
  ): Promise<UserResponseDto | null> {
    this.logger.log(`Get profile request for user: ${user.userId}`);
    if (!user.userId) {
      return null;
    }
    return this.userService.getUserById(user.userId);
  }
}
