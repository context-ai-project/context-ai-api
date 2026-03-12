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
  Inject,
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
import { GenerateScriptUseCase } from '../application/use-cases/generate-script.use-case';
import { GenerateAudioUseCase } from '../application/use-cases/generate-audio.use-case';
import { GenerateVideoUseCase } from '../application/use-cases/generate-video.use-case';

import {
  CreateCapsuleRequestDto,
  UpdateCapsuleRequestDto,
  CapsuleResponseDto,
  PaginatedCapsulesResponseDto,
  GenerateScriptRequestDto,
  GenerateAudioRequestDto,
  VoiceInfoResponseDto,
  SharedVoiceInfoResponseDto,
  DownloadUrlResponseDto,
  CapsuleStatusResponseDto,
} from './dtos/capsule.dto';
import { CapsuleDtoMapper } from './mappers/capsule-dto.mapper';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import type { IAudioGenerator } from '../domain/services/audio-generator.interface';
import type { IMediaStorage } from '../domain/services/media-storage.interface';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const API_AUTH_DESC = 'Authentication required — missing or invalid JWT token';
const API_FORBIDDEN_DESC = 'Access denied — insufficient permissions';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

const PERM_READ = 'capsule:read';
const PERM_CREATE = 'capsule:create';
const PERM_UPDATE = 'capsule:update';
const PERM_DELETE = 'capsule:delete';

/** Contract for audio generation pipeline */
interface IAudioGeneratePipeline {
  startAndProcess(capsuleId: string, voiceId: string): Promise<void>;
}

/** Contract for video generation pipeline */
interface IVideoGeneratePipeline {
  execute(capsuleId: string, voiceId: string): Promise<void>;
  getQuotaInfo(): Promise<{ used: number; limit: number; remaining: number }>;
}

/** Shape of a shared voice from search — avoids ESLint "type could not be resolved" */
interface SharedVoiceItem {
  voiceId: string;
  publicOwnerId: string;
  name: string;
  category?: string;
  language?: string;
  gender?: string;
  accent?: string;
  description?: string;
  previewUrl?: string;
  isAddedByUser?: boolean;
}

/** Contract for searching shared voices — avoids ESLint "type could not be resolved" (IAudioGenerator DI) */
interface ISearchSharedVoices {
  searchSharedVoices(query: string): Promise<SharedVoiceItem[]>;
}

/**
 * Capsules Controller
 *
 * Handles HTTP requests for multimedia capsule management (v2 Block A + B).
 *
 * Permission model:
 * - GET endpoints:    capsule:read (all authenticated users)
 * - POST/PATCH:       capsule:create / capsule:update (admin, manager)
 * - DELETE:           capsule:delete (admin, manager)
 * - Generation:       capsule:create (generate-script, generate-audio, generate-video)
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
    private readonly generateScriptUseCase: GenerateScriptUseCase,
    private readonly generateAudioUseCase: GenerateAudioUseCase,
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    @Inject('IAudioGenerator')
    private readonly audioGenerator: IAudioGenerator,
    @Inject('IMediaStorage')
    private readonly mediaStorage: IMediaStorage,
  ) {}

  // ──────────────────────────────────────────────
  // POST /capsules — Create a new capsule (DRAFT)
  // ──────────────────────────────────────────────
  @Post()
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({ summary: 'Create a new capsule in DRAFT status' })
  @ApiResponse({ status: 201, type: CapsuleResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async create(
    @Body() dto: CreateCapsuleRequestDto,
    @Request() req: { user: { userId: string } },
  ): Promise<CapsuleResponseDto> {
    const capsule = await this.createCapsuleUseCase.execute({
      title: dto.title,
      sectorId: dto.sectorId,
      type: dto.type ?? CapsuleType.AUDIO,
      sourceIds: dto.sourceIds,
      createdBy: req.user.userId,
      introText: dto.introText,
    });

    return CapsuleDtoMapper.toResponse(capsule);
  }

  // ──────────────────────────────────────────────
  // GET /capsules — List with filters + pagination
  // ──────────────────────────────────────────────
  @Get()
  @RequirePermissions([PERM_READ])
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
  // GET /capsules/voices — Available ElevenLabs voices
  // (must be declared before /:id to avoid route collision)
  // ──────────────────────────────────────────────
  @Get('voices')
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({ summary: 'List available ElevenLabs voices' })
  @ApiResponse({ status: 200, type: [VoiceInfoResponseDto] })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getVoices(): Promise<VoiceInfoResponseDto[]> {
    const voices = await this.audioGenerator.getAvailableVoices();
    return voices.map((v) => {
      const dto = new VoiceInfoResponseDto();
      dto.id = v.id;
      dto.name = v.name;
      if (v.category) dto.category = v.category;
      if (v.description) dto.description = v.description;
      if (v.previewUrl) dto.previewUrl = v.previewUrl;
      if (v.labels) dto.labels = v.labels;
      return dto;
    });
  }

  // ──────────────────────────────────────────────
  // GET /capsules/voices/search — Search Shared Voice Library
  // (must be declared before /:id to avoid route collision)
  // ──────────────────────────────────────────────
  @Get('voices/search')
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({ summary: 'Search the ElevenLabs shared voice library' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, type: [SharedVoiceInfoResponseDto] })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async searchSharedVoices(
    @Query('q') query: string,
  ): Promise<SharedVoiceInfoResponseDto[]> {
    if (!query?.trim()) {
      throw new BadRequestException('Search query (q) is required');
    }
    const generator = this.audioGenerator as ISearchSharedVoices;
    const voices = await generator.searchSharedVoices(query.trim());
    return voices.map((item: SharedVoiceItem): SharedVoiceInfoResponseDto => {
      const {
        voiceId,
        publicOwnerId,
        name,
        category,
        language,
        gender,
        accent,
        description,
        previewUrl,
        isAddedByUser,
      } = item;
      const dto: SharedVoiceInfoResponseDto = {
        voiceId,
        publicOwnerId,
        name,
      };
      if (category) dto.category = category;
      if (language) dto.language = language;
      if (gender) dto.gender = gender;
      if (accent) dto.accent = accent;
      if (description) dto.description = description;
      if (previewUrl) dto.previewUrl = previewUrl;
      if (isAddedByUser !== undefined) dto.isAddedByUser = isAddedByUser;
      return dto;
    });
  }

  // ──────────────────────────────────────────────
  // GET /capsules/quota — Video generation quota
  // (must be declared before /:id to avoid route collision)
  // ──────────────────────────────────────────────
  @Get('quota')
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({ summary: 'Get monthly video generation quota' })
  @ApiResponse({
    status: 200,
    schema: {
      properties: {
        used: { type: 'number' },
        limit: { type: 'number' },
        remaining: { type: 'number' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getQuota(): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const provider = this.generateVideoUseCase as IVideoGeneratePipeline;
    return provider.getQuotaInfo();
  }

  // ──────────────────────────────────────────────
  // GET /capsules/:id — Get single capsule
  // ──────────────────────────────────────────────
  @Get(':id')
  @RequirePermissions([PERM_READ])
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
  @RequirePermissions([PERM_UPDATE])
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
  @RequirePermissions([PERM_DELETE])
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
  @RequirePermissions([PERM_UPDATE])
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
  @RequirePermissions([PERM_DELETE])
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

  // ──────────────────────────────────────────────
  // POST /capsules/:id/generate-script
  // ──────────────────────────────────────────────
  @Post(':id/generate-script')
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({ summary: 'Generate a narrative script using Gemini + RAG' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({
    status: 201,
    schema: { properties: { script: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async generateScript(
    @Param('id') id: string,
    @Body() dto: GenerateScriptRequestDto,
  ): Promise<{ script: string }> {
    return this.generateScriptUseCase.execute(id, dto.language);
  }

  // ──────────────────────────────────────────────
  // POST /capsules/:id/generate — Generation pipeline (audio or video)
  // ──────────────────────────────────────────────
  @Post(':id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions([PERM_CREATE])
  @ApiOperation({
    summary:
      'Start generation pipeline — routes to audio or video based on capsule type',
  })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 202, description: 'Generation started' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  @ApiForbiddenResponse({ description: API_FORBIDDEN_DESC })
  async generate(
    @Param('id') id: string,
    @Body() dto: GenerateAudioRequestDto,
  ): Promise<void> {
    if (!dto.voiceId) throw new BadRequestException('voiceId is required');

    // Persist the latest script atomically before kicking off the pipeline
    if (dto.script != null) {
      await this.updateCapsuleUseCase.execute({
        capsuleId: id,
        script: dto.script.trim(),
      });
    }

    const capsule = await this.getCapsuleUseCase.execute(id);

    if (capsule.type === CapsuleType.VIDEO) {
      const useCase: IVideoGeneratePipeline = this.generateVideoUseCase;
      await useCase.execute(id, dto.voiceId);
    } else {
      const useCase: IAudioGeneratePipeline = this.generateAudioUseCase;
      await useCase.startAndProcess(id, dto.voiceId);
    }
  }

  // ──────────────────────────────────────────────
  // GET /capsules/:id/status — Polling endpoint
  // ──────────────────────────────────────────────
  @Get(':id/status')
  @RequirePermissions([PERM_READ])
  @ApiOperation({ summary: 'Get generation status for polling' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiResponse({ status: 200, type: CapsuleStatusResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getStatus(@Param('id') id: string): Promise<CapsuleStatusResponseDto> {
    const capsule = await this.getCapsuleUseCase.execute(id);
    const response = new CapsuleStatusResponseDto();
    response.capsuleId = capsule.id!;
    response.status = capsule.status;
    if (capsule.audioUrl) response.audioUrl = capsule.audioUrl;
    if (capsule.videoUrl) response.videoUrl = capsule.videoUrl;

    const meta = capsule.generationMetadata;
    if (meta && typeof meta['progress'] === 'number') {
      response.progress = meta['progress'];
    }
    if (meta && typeof meta['step'] === 'string') {
      response.currentStep = meta['step'];
    }

    if (capsule.status === CapsuleStatus.FAILED && meta?.['error']) {
      const err = meta['error'] as Record<string, unknown>;
      response.errorMessage =
        (err['reason'] as string | undefined) ??
        (err['message'] as string | undefined) ??
        'Generation failed';
    }

    return response;
  }

  // ──────────────────────────────────────────────
  // GET /capsules/:id/download/:type — Signed URL
  // ──────────────────────────────────────────────
  @Get(':id/download/:type')
  @RequirePermissions([PERM_READ])
  @ApiOperation({ summary: 'Get a time-limited signed URL for audio download' })
  @ApiParam({ name: 'id', example: EXAMPLE_UUID })
  @ApiParam({ name: 'type', enum: ['audio', 'video'] })
  @ApiResponse({ status: 200, type: DownloadUrlResponseDto })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getDownloadUrl(
    @Param('id') id: string,
    @Param('type') type: string,
  ): Promise<DownloadUrlResponseDto> {
    if (type !== 'audio' && type !== 'video') {
      throw new BadRequestException('type must be "audio" or "video"');
    }

    const capsule = await this.getCapsuleUseCase.execute(id);
    const extension = type === 'audio' ? 'mp3' : 'mp4';
    const storagePath = `capsules/${capsule.id}/${type}.${extension}`;

    const url = await this.mediaStorage.getSignedUrl(storagePath);
    const response = new DownloadUrlResponseDto();
    response.url = url;
    return response;
  }
}
