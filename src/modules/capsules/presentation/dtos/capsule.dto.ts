import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';

// ── Validation constants ──────────────────────────────────────────────────────

const TITLE_MIN = 3;
const TITLE_MAX = 255;
const INTRO_MAX = 1000;
const SCRIPT_MAX = 20000;
const VOICE_ID_MAX = 100;
const LANGUAGE_MAX = 10;

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCapsuleRequestDto {
  @ApiProperty({ example: 'Onboarding — Vacation Policy' })
  @IsString()
  @MinLength(TITLE_MIN)
  @MaxLength(TITLE_MAX)
  title!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  sectorId!: string;

  @ApiProperty({ enum: CapsuleType, example: CapsuleType.AUDIO })
  @IsEnum(CapsuleType)
  type!: CapsuleType;

  @ApiProperty({ type: [String], example: ['src-uuid-1', 'src-uuid-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sourceIds!: string[];

  @ApiPropertyOptional({ example: 'Welcome to the company!' })
  @IsOptional()
  @IsString()
  @MaxLength(INTRO_MAX)
  introText?: string;
}

export class UpdateCapsuleRequestDto {
  @ApiPropertyOptional({ example: 'Updated capsule title' })
  @IsOptional()
  @IsString()
  @MinLength(TITLE_MIN)
  @MaxLength(TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ example: 'Welcome to Context.ai!' })
  @IsOptional()
  @IsString()
  @MaxLength(INTRO_MAX)
  introText?: string;

  @ApiPropertyOptional({ example: 'The full narration script...' })
  @IsOptional()
  @IsString()
  @MaxLength(SCRIPT_MAX)
  script?: string;

  @ApiPropertyOptional({ example: 'pNInz6obpgDQGcFmaJgB' })
  @IsOptional()
  @IsString()
  @MaxLength(VOICE_ID_MAX)
  audioVoiceId?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class CapsuleSourceRefResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() sourceType!: string;
}

export class CapsuleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() sectorId!: string;
  @ApiProperty({ enum: CapsuleType }) type!: CapsuleType;
  @ApiProperty({ enum: CapsuleStatus }) status!: CapsuleStatus;
  @ApiPropertyOptional() introText?: string;
  @ApiPropertyOptional() script?: string;
  @ApiPropertyOptional() audioUrl?: string;
  @ApiPropertyOptional() videoUrl?: string;
  @ApiPropertyOptional() thumbnailUrl?: string;
  @ApiPropertyOptional() durationSeconds?: number;
  @ApiPropertyOptional() audioVoiceId?: string;
  @ApiPropertyOptional({
    example: 'es-ES',
    description:
      'BCP-47 language code of the generated script (e.g. "es-ES", "en-US")',
  })
  language?: string;
  @ApiPropertyOptional() generationMetadata?: Record<string, unknown>;
  @ApiProperty() createdBy!: string;
  @ApiPropertyOptional() publishedAt?: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional({ type: [CapsuleSourceRefResponseDto] })
  sources?: CapsuleSourceRefResponseDto[];
}

export class PaginatedCapsulesResponseDto {
  @ApiProperty({ type: [CapsuleResponseDto] }) data!: CapsuleResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class CapsuleStatusResponseDto {
  @ApiProperty() capsuleId!: string;
  @ApiProperty({ enum: CapsuleStatus }) status!: CapsuleStatus;
  @ApiPropertyOptional() currentStep?: string;
  @ApiPropertyOptional() progress?: number;
  @ApiPropertyOptional() errorMessage?: string;
  @ApiPropertyOptional() audioUrl?: string;
}

export class GenerateScriptRequestDto {
  @ApiPropertyOptional({
    example: 'es-ES',
    description:
      'Target language for the script (BCP-47 code, e.g. "es-ES", "en-US")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LANGUAGE_MAX)
  language?: string;
}

export class GenerateAudioRequestDto {
  @ApiProperty({
    example: 'pNInz6obpgDQGcFmaJgB',
    description: 'ElevenLabs voice ID',
  })
  @IsString()
  @MaxLength(VOICE_ID_MAX)
  voiceId!: string;
}

export class VoiceInfoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() previewUrl?: string;
  @ApiPropertyOptional() labels?: Record<string, string>;
}

export class SharedVoiceInfoResponseDto {
  @ApiProperty() voiceId!: string;
  @ApiProperty() publicOwnerId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() language?: string;
  @ApiPropertyOptional() gender?: string;
  @ApiPropertyOptional() accent?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() previewUrl?: string;
  @ApiPropertyOptional() isAddedByUser?: boolean;
}

export class DownloadUrlResponseDto {
  @ApiProperty({
    description: 'Time-limited signed URL for downloading the media file',
  })
  url!: string;
}
