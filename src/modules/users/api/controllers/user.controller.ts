import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from '../../application/services/user.service';
import type {
  SyncUserDto,
  UserResponseDto,
} from '../../application/services/user.service';

/**
 * User Controller
 *
 * Handles HTTP requests for user management
 *
 * Endpoints:
 * - POST /api/v1/users/sync - Sync user from Auth0
 */
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Sync user from Auth0
   * Creates a new user or updates existing user's last login timestamp
   *
   * @param dto - User data from Auth0 (sub, email, name)
   * @returns User with internal UUID
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUser(@Body() dto: SyncUserDto): Promise<UserResponseDto> {
    this.logger.log(`Sync user request: ${dto.auth0UserId}`);
    return this.userService.syncUser(dto);
  }
}
