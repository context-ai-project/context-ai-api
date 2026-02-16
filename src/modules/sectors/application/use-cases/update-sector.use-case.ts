import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import type { ISectorRepository } from '../../domain/repositories/sector.repository.interface';
import { Sector } from '../../domain/entities/sector.entity';
import type { SectorIcon } from '@shared/types';

/**
 * Input DTO for update sector use case
 */
export interface UpdateSectorInput {
  id: string;
  name?: string;
  description?: string;
  icon?: SectorIcon;
}

/**
 * Update Sector Use Case
 *
 * Partially updates an existing sector.
 * Validates:
 * - Sector exists
 * - New name is unique (if changed)
 * - Domain validation rules
 */
@Injectable()
export class UpdateSectorUseCase {
  private readonly logger = new Logger(UpdateSectorUseCase.name);

  constructor(
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
  ) {}

  async execute(input: UpdateSectorInput): Promise<Sector> {
    this.logger.log(`Updating sector: ${input.id}`);

    // Find existing sector
    const sector = await this.sectorRepository.findById(input.id);
    if (!sector) {
      throw new NotFoundException(`Sector not found: ${input.id}`);
    }

    // Check name uniqueness if name changed
    if (input.name !== undefined) {
      const nameExists = await this.sectorRepository.existsByName(
        input.name,
        input.id,
      );
      if (nameExists) {
        throw new ConflictException(
          `A sector with the name "${input.name.trim()}" already exists`,
        );
      }
    }

    // Apply updates (domain entity validates business rules)
    sector.update({
      name: input.name,
      description: input.description,
      icon: input.icon,
    });

    // Persist
    const saved = await this.sectorRepository.save(sector);

    this.logger.log(`Sector updated successfully: ${saved.id}`);
    return saved;
  }
}
