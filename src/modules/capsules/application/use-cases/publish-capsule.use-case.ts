import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';

/**
 * Publish Capsule Use Case
 *
 * Transitions a capsule from COMPLETED → ACTIVE so it becomes
 * visible to end users. Domain entity enforces the status rule.
 */
@Injectable()
export class PublishCapsuleUseCase {
  private readonly logger = new Logger(PublishCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(capsuleId: string): Promise<Capsule> {
    this.logger.log(`Publishing capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    capsule.publish();
    const saved = await this.capsuleRepository.save(capsule);

    this.logger.log(`Capsule published: ${capsuleId}`);
    return saved;
  }
}
