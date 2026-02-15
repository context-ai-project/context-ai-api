import { ApiProperty } from '@nestjs/swagger';

/**
 * Admin dashboard statistics response DTO
 *
 * Aggregates global metrics for the admin dashboard:
 * - Total conversations across all users
 * - Total and recent users
 * - Total documents
 * - Total and active sectors
 */
export class AdminStatsDto {
  @ApiProperty({
    description: 'Total number of conversations across all users',
    example: 42,
  })
  totalConversations!: number;

  @ApiProperty({
    description: 'Total number of registered users',
    example: 15,
  })
  totalUsers!: number;

  @ApiProperty({
    description: 'Number of users created in the last 30 days',
    example: 3,
  })
  recentUsers!: number;

  @ApiProperty({
    description: 'Total number of knowledge documents',
    example: 56,
  })
  totalDocuments!: number;

  @ApiProperty({
    description: 'Total number of sectors',
    example: 8,
  })
  totalSectors!: number;

  @ApiProperty({
    description: 'Number of sectors with ACTIVE status',
    example: 6,
  })
  activeSectors!: number;
}
