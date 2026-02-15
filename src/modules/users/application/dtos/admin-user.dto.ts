import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsArray,
  IsUUID,
  IsOptional,
} from 'class-validator';

/**
 * DTO for updating a user's role (admin only)
 */
export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role name to assign',
    example: 'manager',
    enum: ['admin', 'manager', 'user'],
  })
  @IsNotEmpty()
  @IsString()
  role!: string;
}

/**
 * DTO for toggling a user's active status (admin only)
 */
export class ToggleUserStatusDto {
  @ApiProperty({
    description: 'New active status',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;
}

/**
 * DTO for updating user-sector associations (admin only)
 */
export class UpdateUserSectorsDto {
  @ApiProperty({
    description: 'Array of sector UUIDs to assign to the user',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  sectorIds!: string[];
}

/**
 * Response DTO for admin user list
 */
export class AdminUserResponseDto {
  @ApiProperty({ description: 'User UUID' })
  id!: string;

  @ApiProperty({ description: 'Auth0 user ID' })
  auth0UserId!: string;

  @ApiProperty({ description: 'User email' })
  email!: string;

  @ApiProperty({ description: 'User full name' })
  name!: string;

  @ApiProperty({ description: 'Whether the user is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Assigned roles', type: [String] })
  roles!: string[];

  @ApiProperty({
    description: 'Assigned sector IDs',
    type: [String],
  })
  sectorIds!: string[];

  @ApiProperty({ description: 'User creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last login date', nullable: true })
  lastLoginAt!: Date | null;
}

/**
 * Query parameters for searching/filtering users
 */
export class AdminUserQueryDto {
  @ApiPropertyOptional({
    description: 'Search by name or email (case-insensitive)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
