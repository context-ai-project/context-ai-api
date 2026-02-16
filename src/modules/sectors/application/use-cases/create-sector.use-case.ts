import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import type { ISectorRepository } from '../../domain/repositories/sector.repository.interface';
import { Sector } from '../../domain/entities/sector.entity';
import type { SectorIcon } from '@shared/types';

/**
 * Input DTO for create sector use case
 */
export interface CreateSectorInput {
  name: string;
  description: string;
  icon: SectorIcon;
}

/**
 * Create Sector Use Case
 *
 * Creates a new sector after validating:
 * - Name uniqueness (case-insensitive)
 * - Domain entity validation (length, icon validity)
 */
@Injectable()
export class CreateSectorUseCase {
  private readonly logger = new Logger(CreateSectorUseCase.name);

  constructor(
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
  ) {}

  async execute(input: CreateSectorInput): Promise<Sector> {
    this.logger.log(`Creating sector: ${input.name}`);

    // Check name uniqueness
    const nameExists = await this.sectorRepository.existsByName(input.name);
    if (nameExists) {
      throw new ConflictException(
        `A sector with the name "${input.name.trim()}" already exists`,
      );
    }

    // Create domain entity (validates business rules)
    const sector = new Sector({
      name: input.name,
      description: input.description,
      icon: input.icon,
    });

    // Persist
    const saved = await this.sectorRepository.save(sector);

    this.logger.log(`Sector created successfully: ${saved.id}`);
    return saved;
  }
}
