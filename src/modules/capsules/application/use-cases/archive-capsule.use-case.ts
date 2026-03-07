import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';

/**
 * Archive Capsule Use Case
 *
 * Transitions a capsule from ACTIVE or COMPLETED → ARCHIVED.
 * Archived capsules are no longer visible to end users.
 * Domain entity enforces the allowed source statuses.
 */
@Injectable()
export class ArchiveCapsuleUseCase {
  private readonly logger = new Logger(ArchiveCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(capsuleId: string): Promise<Capsule> {
    this.logger.log(`Archiving capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    capsule.archive();
    const saved = await this.capsuleRepository.save(capsule);

    this.logger.log(`Capsule archived: ${capsuleId}`);
    return saved;
  }
}
