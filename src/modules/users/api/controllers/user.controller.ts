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
  ApiHeader,
} from '@nestjs/swagger';
import { UserService } from '../../application/services/user.service';
import type {
  SyncUserDto,
  UserResponseDto,
} from '../../application/services/user.service';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Public } from '../../../auth/decorators/public.decorator';
import { InternalApiKeyGuard } from '../../../auth/guards/internal-api-key.guard';
import type { ValidatedUser } from '../../../auth/types/jwt-payload.type';

/**
 * User Controller
 *
 * Handles HTTP requests for user management.
 *
 * Endpoints:
 * - POST /users/sync: Sync user from Auth0 (server-to-server, internal API key)
 * - GET /users/profile: Get current user profile (JWT required)
 *
 * Authorization:
 * - Sync endpoint: @Public() + InternalApiKeyGuard (server-to-server bootstrap)
 * - Profile endpoint: JWT authentication + 'profile:read' permission
 *
 * The /sync endpoint is called by NextAuth during the login callback to create
 * or update users and obtain their internal UUID before the JWT session exists.
 */
@ApiTags('Users')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Sync user from Auth0
   *
   * Creates a new user or updates existing user's last login timestamp.
   * Called by the frontend server (NextAuth) during the login callback
   * to obtain the user's internal UUID.
   *
   * Security: Protected by internal API key (X-Internal-API-Key header),
   * not JWT, because this endpoint is called before the JWT session exists.
   *
   * @param dto - User data from Auth0 (sub, email, name)
   * @returns User with internal UUID
   */
  @Public()
  @UseGuards(InternalApiKeyGuard)
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync user from Auth0 (Server-to-server)',
    description:
      'Sync a user from Auth0. Creates a new user or updates last login timestamp. ' +
      'This endpoint is called by the frontend server (NextAuth) during the login callback. ' +
      '\n\n**Security:** Requires X-Internal-API-Key header (server-to-server only)',
  })
  @ApiHeader({
    name: 'X-Internal-API-Key',
    description: 'Internal API key for server-to-server authentication',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User synced successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid internal API key',
  })
  async syncUser(@Body() dto: SyncUserDto): Promise<UserResponseDto> {
    this.logger.log(`Sync user request: ${dto.auth0UserId}`);
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
  @ApiBearerAuth()
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
