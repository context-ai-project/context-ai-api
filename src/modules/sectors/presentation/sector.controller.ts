import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
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
import { CreateSectorUseCase } from '../application/use-cases/create-sector.use-case';
import { UpdateSectorUseCase } from '../application/use-cases/update-sector.use-case';
import { DeleteSectorUseCase } from '../application/use-cases/delete-sector.use-case';
import { ToggleSectorStatusUseCase } from '../application/use-cases/toggle-sector-status.use-case';
import type { ISectorRepository } from '../domain/repositories/sector.repository.interface';
import type { IKnowledgeRepository } from '../../knowledge/domain/repositories/knowledge.repository.interface';
import {
  CreateSectorDto,
  UpdateSectorDto,
  SectorResponseDto,
  ToggleStatusResponseDto,
  DeleteSectorResponseDto,
} from './dtos/sector.dto';
import { SectorDtoMapper } from './mappers/sector-dto.mapper';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { isValidUUID } from '@shared/validators';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

// API description constants
const API_AUTH_DESC = 'Authentication required - Missing or invalid JWT token';
const API_FORBIDDEN_DESC = 'Access denied - Requires admin role';
const API_PARAM_SECTOR_UUID_DESC = 'Sector UUID';
const API_SECTOR_NOT_FOUND_DESC = 'Sector not found';

// Example UUID for documentation
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Sector Controller
 *
 * Handles HTTP requests for sector management operations.
 *
 * Read-only endpoints (GET) are accessible to all authenticated users.
 * Write endpoints (POST, PATCH, DELETE) require admin role.
 *
 * Endpoints:
 * - GET    /sectors         → List all sectors (any authenticated user)
 * - GET    /sectors/:id     → Get sector by ID (any authenticated user)
 * - POST   /sectors         → Create a new sector (admin only)
 * - PATCH  /sectors/:id     → Update a sector (admin only)
 * - DELETE /sectors/:id     → Delete a sector (admin only)
 * - PATCH  /sectors/:id/status → Toggle sector active/inactive (admin only)
 */
@ApiTags('Sectors')
@ApiBearerAuth()
@Controller('sectors')
export class SectorController {
  private readonly logger = new Logger(SectorController.name);

  constructor(
    private readonly createSectorUseCase: CreateSectorUseCase,
    private readonly updateSectorUseCase: UpdateSectorUseCase,
    private readonly deleteSectorUseCase: DeleteSectorUseCase,
    private readonly toggleSectorStatusUseCase: ToggleSectorStatusUseCase,
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
    @Inject('IKnowledgeRepository')
    private readonly knowledgeRepository: IKnowledgeRepository,
  ) {}

  // ==================== LIST ALL SECTORS ====================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all sectors',
    description:
      'Returns all sectors with their document counts.\n\nAccessible to all authenticated users.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of sectors',
    type: [SectorResponseDto],
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async listSectors(): Promise<SectorResponseDto[]> {
    this.logger.log('List sectors request');

    try {
      const sectors = await this.sectorRepository.findAll();

      // Batch query: one SQL GROUP BY instead of N+1 individual counts
      const sectorIds = sectors
        .map((s) => s.id ?? '')
        .filter((id) => id !== '');
      const countsMap =
        await this.knowledgeRepository.countSourcesBySectorIds(sectorIds);

      return SectorDtoMapper.toResponseList(sectors, countsMap);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to list sectors: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== GET SECTOR BY ID ====================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get sector by ID',
    description:
      'Returns a single sector with its document count.\n\nAccessible to all authenticated users.',
  })
  @ApiParam({
    name: 'id',
    description: API_PARAM_SECTOR_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Sector detail',
    type: SectorResponseDto,
  })
  @ApiResponse({ status: 404, description: API_SECTOR_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getSector(@Param('id') id: string): Promise<SectorResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Get sector: ${id}`);

    try {
      const sector = await this.sectorRepository.findById(id);
      if (!sector) {
        throw new BadRequestException(`Sector not found: ${id}`);
      }

      const documentCount =
        await this.knowledgeRepository.countSourcesBySector(id);

      return SectorDtoMapper.toResponse(sector, documentCount);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to get sector: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== CREATE SECTOR ====================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('admin')
  @ApiOperation({
    summary: 'Create a new sector',
    description:
      'Creates a new sector with a unique name.\n\n**Required Role:** admin',
  })
  @ApiResponse({
    status: 201,
    description: 'Sector created',
    type: SectorResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Sector name already exists' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async createSector(@Body() dto: CreateSectorDto): Promise<SectorResponseDto> {
    this.logger.log(`Create sector: ${dto.name}`);

    try {
      const sector = await this.createSectorUseCase.execute({
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
      });

      return SectorDtoMapper.toResponse(sector, 0);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create sector: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== UPDATE SECTOR ====================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('admin')
  @ApiOperation({
    summary: 'Update a sector',
    description:
      'Partially updates an existing sector.\n\n**Required Role:** admin',
  })
  @ApiParam({
    name: 'id',
    description: API_PARAM_SECTOR_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Sector updated',
    type: SectorResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: API_SECTOR_NOT_FOUND_DESC })
  @ApiResponse({ status: 409, description: 'Sector name already exists' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async updateSector(
    @Param('id') id: string,
    @Body() dto: UpdateSectorDto,
  ): Promise<SectorResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Update sector: ${id}`);

    try {
      const sector = await this.updateSectorUseCase.execute({
        id,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
      });

      const documentCount =
        await this.knowledgeRepository.countSourcesBySector(id);

      return SectorDtoMapper.toResponse(sector, documentCount);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update sector: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== DELETE SECTOR ====================

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('admin')
  @ApiOperation({
    summary: 'Delete a sector',
    description:
      'Deletes a sector only if it has no associated documents.\n\n**Required Role:** admin',
  })
  @ApiParam({
    name: 'id',
    description: API_PARAM_SECTOR_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Sector deleted',
    type: DeleteSectorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete — sector has documents',
  })
  @ApiResponse({ status: 404, description: API_SECTOR_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async deleteSector(
    @Param('id') id: string,
  ): Promise<DeleteSectorResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Delete sector: ${id}`);

    try {
      const result = await this.deleteSectorUseCase.execute(id);
      return { id: result.id, message: result.message };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to delete sector: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== TOGGLE STATUS ====================

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('admin')
  @ApiOperation({
    summary: 'Toggle sector status (active/inactive)',
    description:
      'Toggles a sector between active and inactive. ' +
      'Inactive sectors are not available for chat or document uploads.\n\n**Required Role:** admin',
  })
  @ApiParam({
    name: 'id',
    description: API_PARAM_SECTOR_UUID_DESC,
    example: EXAMPLE_UUID,
  })
  @ApiResponse({
    status: 200,
    description: 'Status toggled',
    type: ToggleStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: API_SECTOR_NOT_FOUND_DESC })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async toggleStatus(
    @Param('id') id: string,
  ): Promise<ToggleStatusResponseDto> {
    this.validateUUID(id, 'id');
    this.logger.log(`Toggle sector status: ${id}`);

    try {
      const result = await this.toggleSectorStatusUseCase.execute(id);
      return {
        id: result.id,
        status: result.status,
        message: result.message,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to toggle sector status: ${extractErrorMessage(error)}`,
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
