import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ISectorRepository } from '../../domain/repositories/sector.repository.interface';
import type { SectorStatus } from '@shared/types';

/**
 * Toggle Sector Status Response
 */
export interface ToggleSectorStatusResult {
  id: string;
  status: SectorStatus;
  message: string;
}

/**
 * Toggle Sector Status Use Case
 *
 * Toggles a sector between active and inactive.
 * When inactive, the sector is not available for chat or document uploads.
 */
@Injectable()
export class ToggleSectorStatusUseCase {
  private readonly logger = new Logger(ToggleSectorStatusUseCase.name);

  constructor(
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
  ) {}

  async execute(id: string): Promise<ToggleSectorStatusResult> {
    this.logger.log(`Toggling sector status: ${id}`);

    // Find existing sector
    const sector = await this.sectorRepository.findById(id);
    if (!sector) {
      throw new NotFoundException(`Sector not found: ${id}`);
    }

    const previousStatus = sector.status;

    // Toggle status
    sector.toggleStatus();

    // Persist
    await this.sectorRepository.save(sector);

    const action = sector.isActive() ? 'activated' : 'deactivated';
    this.logger.log(
      `Sector ${action}: ${id} (${previousStatus} → ${sector.status})`,
    );

    return {
      id: sector.id ?? id,
      status: sector.status,
      message: `Sector ${action} successfully`,
    };
  }
}
