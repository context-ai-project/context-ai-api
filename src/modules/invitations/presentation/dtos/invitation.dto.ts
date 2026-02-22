import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsArray,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { InvitationStatus } from '@shared/types';

const MAX_NAME_LENGTH = 255;
const MIN_NAME_LENGTH = 2;

/**
 * DTO for creating a new invitation
 */
export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email of the invited user',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Full name of the invited user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_NAME_LENGTH)
  @MaxLength(MAX_NAME_LENGTH)
  name!: string;

  @ApiPropertyOptional({
    description: 'Role to assign (user or admin)',
    example: 'user',
    default: 'user',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['user', 'admin'], {
    message: 'role must be user or admin',
  })
  role?: string;

  @ApiPropertyOptional({
    description: 'Sector IDs to assign to the invited user',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  sectorIds?: string[];
}

/**
 * DTO for invitation response
 */
export class InvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID' })
  id!: string;

  @ApiProperty({ description: 'Invited email' })
  email!: string;

  @ApiProperty({ description: 'Invited name' })
  name!: string;

  @ApiProperty({ description: 'Role assigned' })
  role!: string;

  @ApiProperty({
    description: 'Invitation status',
    enum: InvitationStatus,
  })
  status!: InvitationStatus;

  @ApiProperty({ description: 'Sectors assigned' })
  sectors!: InvitationSectorDto[];

  @ApiProperty({ description: 'Invited by user name' })
  invitedByName!: string;

  @ApiProperty({ description: 'Expiration date' })
  expiresAt!: Date;

  @ApiPropertyOptional({ description: 'Acceptance date' })
  acceptedAt?: Date | null;

  @ApiProperty({ description: 'Created date' })
  createdAt!: Date;
}

/**
 * DTO for sectors in invitation response
 */
export class InvitationSectorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

/**
 * DTO for listing invitations with optional status filter
 */
export class ListInvitationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: InvitationStatus,
  })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}
