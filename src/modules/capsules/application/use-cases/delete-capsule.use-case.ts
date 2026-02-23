import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';

/**
 * Delete Capsule Use Case
 *
 * Soft-deletes a capsule by setting its status to ARCHIVED.
 * Uses `softDelete()` which accepts any non-archived status,
 * unlike `archive()` which is restricted to ACTIVE/COMPLETED
 * (used by the semantic "Archive" action in the player UI).
 */
@Injectable()
export class DeleteCapsuleUseCase {
  private readonly logger = new Logger(DeleteCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(capsuleId: string): Promise<void> {
    this.logger.log(`Archiving capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    capsule.softDelete();
    await this.capsuleRepository.save(capsule);

    this.logger.log(`Capsule archived: ${capsuleId}`);
  }
}
