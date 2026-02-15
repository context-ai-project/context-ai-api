import type { Sector } from '../../domain/entities/sector.entity';
import type { SectorResponseDto } from '../dtos/sector.dto';

/**
 * Maps Sector domain entities to presentation DTOs.
 *
 * Keeps the controller thin by centralising all DTO-mapping logic here.
 * Follows the same pattern as InteractionDtoMapper.
 */
export class SectorDtoMapper {
  /**
   * Map a Sector domain entity → SectorResponseDto
   *
   * @param sector - The domain entity
   * @param documentCount - Number of documents in this sector
   * @returns DTO ready for API response
   */
  static toResponse(sector: Sector, documentCount: number): SectorResponseDto {
    return {
      id: sector.id ?? '',
      name: sector.name,
      description: sector.description,
      icon: sector.icon,
      status: sector.status,
      documentCount,
      createdAt: sector.createdAt.toISOString(),
      updatedAt: sector.updatedAt.toISOString(),
    };
  }

  /**
   * Map an array of Sectors → SectorResponseDto[] using a batch count map.
   * Eliminates N+1 queries by accepting a pre-fetched counts map.
   *
   * @param sectors - Array of domain entities
   * @param countsMap - Map of sectorId → document count
   * @returns Array of DTOs
   */
  static toResponseList(
    sectors: Sector[],
    countsMap: Map<string, number>,
  ): SectorResponseDto[] {
    return sectors.map((sector) => {
      const sectorId = sector.id ?? '';
      const documentCount = countsMap.get(sectorId) ?? 0;
      return SectorDtoMapper.toResponse(sector, documentCount);
    });
  }
}
