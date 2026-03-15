import {
  Controller,
  Post,
  Param,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Public } from '../../auth/decorators/public.decorator';
import { InternalApiKeyGuard } from '../../auth/guards/internal-api-key.guard';
import { VideoPipelineService } from '../application/services/video-pipeline.service';

class ProcessVideoBodyDto {
  @IsString()
  @IsNotEmpty()
  voiceId!: string;
}

/**
 * Internal Capsules Controller
 *
 * Webhook endpoint invoked by Google Cloud Tasks to process
 * video generation in the background. Protected by InternalApiKeyGuard
 * (x-internal-api-key header) — bypasses JWT authentication.
 */
@ApiTags('Internal')
@ApiExcludeController()
@Controller('internal/capsules')
export class InternalCapsulesController {
  private readonly logger = new Logger(InternalCapsulesController.name);

  constructor(private readonly videoPipeline: VideoPipelineService) {}

  @Post(':id/process-video')
  @Public()
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async processVideo(
    @Param('id') capsuleId: string,
    @Body() body: ProcessVideoBodyDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received video processing webhook for capsule ${capsuleId}`,
    );

    await this.videoPipeline.processVideo(capsuleId, body.voiceId);

    return { status: 'completed' };
  }
}
