import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';

/**
 * Get Capsule Use Case
 *
 * Retrieves a single capsule by ID with its associated knowledge sources.
 * Throws NotFoundException if the capsule does not exist.
 */
@Injectable()
export class GetCapsuleUseCase {
  private readonly logger = new Logger(GetCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(capsuleId: string): Promise<Capsule> {
    this.logger.debug(`Fetching capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    // Hydrate sources
    capsule.sources = await this.capsuleRepository.getSources(capsuleId);

    return capsule;
  }
}
