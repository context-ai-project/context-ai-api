import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { SectorIcon, SectorStatus } from '@shared/types';

// Validation constants (aligned with domain entity)
const NAME_MIN = 2;
const NAME_MAX = 100;
const DESC_MIN = 10;
const DESC_MAX = 500;

// Example values
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * DTO for creating a new sector
 */
export class CreateSectorDto {
  @ApiProperty({
    description: 'Sector name (must be unique)',
    example: 'Human Resources',
    minLength: NAME_MIN,
    maxLength: NAME_MAX,
  })
  @IsString()
  @MinLength(NAME_MIN)
  @MaxLength(NAME_MAX)
  name!: string;

  @ApiProperty({
    description: 'Sector description',
    example:
      'Company policies, benefits, onboarding guides, and employee handbook.',
    minLength: DESC_MIN,
    maxLength: DESC_MAX,
  })
  @IsString()
  @MinLength(DESC_MIN)
  @MaxLength(DESC_MAX)
  description!: string;

  @ApiProperty({
    description: 'Sector icon identifier (Lucide icon name)',
    enum: SectorIcon,
    example: SectorIcon.USERS,
  })
  @IsEnum(SectorIcon)
  icon!: SectorIcon;
}

/**
 * DTO for updating an existing sector
 */
export class UpdateSectorDto {
  @ApiPropertyOptional({
    description: 'Updated sector name',
    example: 'Human Resources & People',
    minLength: NAME_MIN,
    maxLength: NAME_MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(NAME_MIN)
  @MaxLength(NAME_MAX)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated sector description',
    example: 'Updated policies and procedures for all employees.',
    minLength: DESC_MIN,
    maxLength: DESC_MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(DESC_MIN)
  @MaxLength(DESC_MAX)
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated sector icon',
    enum: SectorIcon,
    example: SectorIcon.USERS,
  })
  @IsOptional()
  @IsEnum(SectorIcon)
  icon?: SectorIcon;
}

/**
 * DTO for sector response (list item)
 */
export class SectorResponseDto {
  @ApiProperty({ description: 'Sector ID', example: EXAMPLE_UUID })
  id!: string;

  @ApiProperty({ description: 'Sector name', example: 'Human Resources' })
  name!: string;

  @ApiProperty({
    description: 'Sector description',
    example: 'Company policies, benefits, onboarding guides.',
  })
  description!: string;

  @ApiProperty({
    description: 'Sector icon',
    enum: SectorIcon,
    example: SectorIcon.USERS,
  })
  icon!: SectorIcon;

  @ApiProperty({
    description: 'Sector status',
    enum: SectorStatus,
    example: SectorStatus.ACTIVE,
  })
  status!: SectorStatus;

  @ApiProperty({
    description: 'Number of associated documents',
    example: 18,
  })
  documentCount!: number;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-20T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update date',
    example: '2025-12-15T00:00:00.000Z',
  })
  updatedAt!: string;
}

/**
 * DTO for toggle status response
 */
export class ToggleStatusResponseDto {
  @ApiProperty({ description: 'Sector ID', example: EXAMPLE_UUID })
  id!: string;

  @ApiProperty({
    description: 'New sector status',
    enum: SectorStatus,
    example: SectorStatus.INACTIVE,
  })
  status!: SectorStatus;

  @ApiProperty({
    description: 'Status change message',
    example: 'Sector deactivated successfully',
  })
  message!: string;
}

/**
 * DTO for delete sector response
 */
export class DeleteSectorResponseDto {
  @ApiProperty({ description: 'Deleted sector ID', example: EXAMPLE_UUID })
  id!: string;

  @ApiProperty({
    description: 'Deletion message',
    example: 'Sector deleted successfully',
  })
  message!: string;
}
