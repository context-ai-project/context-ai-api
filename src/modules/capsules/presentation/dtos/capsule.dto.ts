import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateCapsuleRequestDto {
  @ApiProperty({ example: 'Onboarding — Vacation Policy' })
  title!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  sectorId!: string;

  @ApiProperty({ enum: CapsuleType, example: CapsuleType.AUDIO })
  type!: CapsuleType;

  @ApiProperty({ type: [String], example: ['src-uuid-1', 'src-uuid-2'] })
  sourceIds!: string[];

  @ApiPropertyOptional({ example: 'Welcome to the company!' })
  introText?: string;
}

export class UpdateCapsuleRequestDto {
  @ApiPropertyOptional({ example: 'Updated capsule title' })
  title?: string;

  @ApiPropertyOptional({ example: 'Welcome to Context.ai!' })
  introText?: string;

  @ApiPropertyOptional({ example: 'The full narration script...' })
  script?: string;

  @ApiPropertyOptional({ example: 'pNInz6obpgDQGcFmaJgB' })
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
    example: 'es',
    description: 'Target language for the script',
  })
  language?: string;
}

export class GenerateAudioRequestDto {
  @ApiProperty({
    example: 'pNInz6obpgDQGcFmaJgB',
    description: 'ElevenLabs voice ID',
  })
  voiceId!: string;
}

export class VoiceInfoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() previewUrl?: string;
  @ApiPropertyOptional() labels?: Record<string, string>;
}

export class DownloadUrlResponseDto {
  @ApiProperty({
    description: 'Time-limited signed URL for downloading the media file',
  })
  url!: string;
}
