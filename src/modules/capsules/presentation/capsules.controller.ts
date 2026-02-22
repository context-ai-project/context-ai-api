import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { CreateCapsuleUseCase } from '../application/use-cases/create-capsule.use-case';
import { ListCapsulesUseCase } from '../application/use-cases/list-capsules.use-case';
import { GetCapsuleUseCase } from '../application/use-cases/get-capsule.use-case';
import { UpdateCapsuleUseCase } from '../application/use-cases/update-capsule.use-case';
import { DeleteCapsuleUseCase } from '../application/use-cases/delete-capsule.use-case';
import { PublishCapsuleUseCase } from '../application/use-cases/publish-capsule.use-case';
import { ArchiveCapsuleUseCase } from '../application/use-cases/archive-capsule.use-case';

import {
  CreateCapsuleRequestDto,
  UpdateCapsuleRequestDto,
  CapsuleResponseDto,
  PaginatedCapsulesResponseDto,
} from './dtos/capsule.dto';
import { CapsuleDtoMapper } from './mappers/capsule-dto.mapper';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const API_AUTH_DESC = 'Authentication required — missing or invalid JWT token';
const API_FORBIDDEN_DESC = 'Access denied — insufficient permissions';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Capsules Controller
 *
 * Handles HTTP requests for multimedia capsule management (v2 Block A).
 *
 * Permission model:
 * - GET endpoints: capsule:read (all authenticated users)
 * - POST/PATCH:    capsule:create / capsule:update (admin, manager)
 * - DELETE:        capsule:delete (admin, manager)
 *
 * Generation endpoints (generate-script, generate-audio) are added in
 * Fase 2c once ElevenLabs and GCS services are wired.
 */
@ApiTags('Capsules')
@ApiBearerAuth()
@Controller('capsules')
export class CapsulesController {
  private readonly logger = new Logger(CapsulesController.name);

  constructor(
    private readonly createCapsuleUseCase: CreateCapsuleUseCase,
    private readonly listCapsulesUseCase: ListCapsulesUseCase,
    private readonly getCapsuleUseCase: GetCapsuleUseCase,
    private readonly updateCapsuleUseCase: UpdateCapsuleUseCase,
    private readonly deleteCapsuleUseCase: DeleteCapsuleUseCase,
    private readonly publishCapsuleUseCase: PublishCapsuleUseCase,
    private readonly archiveCapsuleUseCase: ArchiveCapsuleUseCase,
  ) {}

  // ──────────────────────────────────────────────
  // POST /capsules — Create a new capsule (DRAFT)
  // ──────────────────────────────────────────────
  @Post()
  @RequirePermissions(['capsule:create'])
  @ApiOperation({ summary: 'Create a new capsule in DRAFT status' })
  @ApiResponse({ status: 201, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async create(
    @Body() dto: CreateCapsuleRequestDto,
    @Request() req: { user: { sub: string; dbId: string } },
  ): Promise<CapsuleResponseDto> {
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    if (!dto.sectorId) throw new BadRequestException('sectorId is required');
    if (!dto.sourceIds?.length)
      throw new BadRequestException('At least one sourceId is required');

    const capsule = await this.createCapsuleUseCase.execute({
      title: dto.title,
      sectorId: dto.sectorId,
      type: dto.type ?? CapsuleType.AUDIO,
      sourceIds: dto.sourceIds,
      createdBy: req.user.dbId ?? req.user.sub,
      introText: dto.introText,
    });

    return CapsuleDtoMapper.toResponse(capsule);
  }

  // ──────────────────────────────────────────────
  // GET /capsules — List with filters + pagination
  // ──────────────────────────────────────────────
  @Get()
  @RequirePermissions(['capsule:read'])
  @ApiOperation({
    summary: 'List capsules with optional filters and pagination',
  })
  @ApiQuery({ name: 'sectorId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: CapsuleStatus })
  @ApiQuery({ name: 'type', required: false, enum: CapsuleType })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: PaginatedCapsulesResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async list(
    @Query('sectorId') sectorId?: string,
    @Query('status') status?: CapsuleStatus,
    @Query('type') type?: CapsuleType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyActive') onlyActive?: string,
  ): Promise<PaginatedCapsulesResponseDto> {
    const result = await this.listCapsulesUseCase.execute({
      sectorId,
      status,
      type,
      search,
      page: page ? parseInt(page, 10) : DEFAULT_PAGE,
      limit: limit ? parseInt(limit, 10) : DEFAULT_LIMIT,
      onlyActive: onlyActive === 'true',
    });

    return {
      data: result.data.map((c) => CapsuleDtoMapper.toResponse(c)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  // ──────────────────────────────────────────────
  // GET /capsules/:id — Get single capsule
  // ──────────────────────────────────────────────
  @Get(':id')
  @RequirePermissions(['capsule:read'])
  @ApiOperation({ summary: 'Get a capsule by ID' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 200, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getById(@Param('id') id: string): Promise<CapsuleResponseDto> {
    const capsule = await this.getCapsuleUseCase.execute(id);
    return CapsuleDtoMapper.toResponse(capsule);
  }

  // ──────────────────────────────────────────────
  // PATCH /capsules/:id — Update editable fields
  // ──────────────────────────────────────────────
  @Patch(':id')
  @RequirePermissions(['capsule:update'])
  @ApiOperation({
    summary: 'Update editable capsule fields (script, voice, title)',
  })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 200, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCapsuleRequestDto,
  ): Promise<CapsuleResponseDto> {
    const capsule = await this.updateCapsuleUseCase.execute({
      capsuleId: id,
      title: dto.title,
      introText: dto.introText,
      script: dto.script,
      audioVoiceId: dto.audioVoiceId,
    });
    return CapsuleDtoMapper.toResponse(capsule);
  }

  // ──────────────────────────────────────────────
  // DELETE /capsules/:id — Soft delete (archive)
  // ──────────────────────────────────────────────
  @Delete(':id')
  @RequirePermissions(['capsule:delete'])
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive (soft-delete) a capsule' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 204, description: 'Capsule archived' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteCapsuleUseCase.execute(id);
  }

  // ──────────────────────────────────────────────
  // POST /capsules/:id/publish
  // ──────────────────────────────────────────────
  @Post(':id/publish')
  @RequirePermissions(['capsule:update'])
  @ApiOperation({ summary: 'Publish a COMPLETED capsule (COMPLETED → ACTIVE)' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 200, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async publish(@Param('id') id: string): Promise<CapsuleResponseDto> {
    const capsule = await this.publishCapsuleUseCase.execute(id);
    return CapsuleDtoMapper.toResponse(capsule);
  }

  // ──────────────────────────────────────────────
  // POST /capsules/:id/archive
  // ──────────────────────────────────────────────
  @Post(':id/archive')
  @RequirePermissions(['capsule:delete'])
  @ApiOperation({
    summary: 'Archive a capsule (ACTIVE | COMPLETED → ARCHIVED)',
  })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 200, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async archive(@Param('id') id: string): Promise<CapsuleResponseDto> {
    const capsule = await this.archiveCapsuleUseCase.execute(id);
    return CapsuleDtoMapper.toResponse(capsule);
  }
}
