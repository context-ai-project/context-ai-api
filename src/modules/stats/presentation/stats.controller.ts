import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { AdminStatsDto } from './dtos/admin-stats.dto';
import { UserRepository } from '../../users/infrastructure/persistence/repositories/user.repository';
import type { IConversationRepository } from '../../interaction/domain/repositories/conversation.repository.interface';
import type { ISectorRepository } from '../../sectors/domain/repositories/sector.repository.interface';
import type { IKnowledgeRepository } from '../../knowledge/domain/repositories/knowledge.repository.interface';
import { SectorStatus } from '@shared/types/enums';
import {
  extractErrorMessage,
  extractErrorStack,
} from '@shared/utils/error.utils';

// API documentation constants
const API_AUTH_DESC = 'Authentication required – Missing or invalid JWT token';
const API_FORBIDDEN_DESC = 'Access denied – Requires admin role';

/**
 * Stats Controller
 *
 * Provides aggregated platform statistics for the admin dashboard.
 *
 * Endpoints:
 * - GET /admin/stats: Global platform statistics
 *
 * Authorization:
 * - All endpoints require admin role
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@RequireRoles('admin')
export class StatsController {
  private readonly logger = new Logger(StatsController.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository,
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
    @Inject('IKnowledgeRepository')
    private readonly knowledgeRepository: IKnowledgeRepository,
  ) {}

  /**
   * GET /admin/stats
   *
   * Returns aggregated platform-wide metrics:
   * - Total conversations (across all users)
   * - Total users and recent registrations
   * - Total documents
   * - Total and active sectors
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description:
      'Returns aggregated platform-wide statistics for the admin dashboard.\n\n' +
      '**Required Role:** admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics',
    type: AdminStatsDto,
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async getStats(): Promise<AdminStatsDto> {
    this.logger.log('Admin stats request');

    try {
      // Use dedicated COUNT queries instead of loading full entities
      const [
        totalConversations,
        totalUsers,
        recentUsers,
        totalDocuments,
        totalSectors,
        activeSectors,
      ] = await Promise.all([
        this.conversationRepository.countAll(),
        this.userRepository.countAll(),
        this.userRepository.countRecent(),
        this.knowledgeRepository.countAllSources(),
        this.sectorRepository.countAll(),
        this.sectorRepository.countByStatus(SectorStatus.ACTIVE),
      ]);

      return {
        totalConversations,
        totalUsers,
        recentUsers,
        totalDocuments,
        totalSectors,
        activeSectors,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get admin stats: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }
}
