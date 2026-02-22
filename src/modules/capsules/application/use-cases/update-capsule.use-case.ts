import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';

export interface UpdateCapsuleInput {
  capsuleId: string;
  title?: string;
  introText?: string;
  script?: string;
  audioVoiceId?: string;
}

/**
 * Update Capsule Use Case
 *
 * Updates editable fields of an existing capsule.
 * Business rules (enforced by the domain entity):
 * - Only allowed when status is DRAFT, COMPLETED, or FAILED
 */
@Injectable()
export class UpdateCapsuleUseCase {
  private readonly logger = new Logger(UpdateCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(input: UpdateCapsuleInput): Promise<Capsule> {
    this.logger.log(`Updating capsule: ${input.capsuleId}`);

    const capsule = await this.capsuleRepository.findById(input.capsuleId);
    if (!capsule) {
      throw new NotFoundException(
        `Capsule with ID "${input.capsuleId}" not found`,
      );
    }

    // Domain entity validates status and field rules
    capsule.update({
      title: input.title,
      introText: input.introText,
      script: input.script,
      audioVoiceId: input.audioVoiceId,
    });

    const saved = await this.capsuleRepository.save(capsule);
    saved.sources = await this.capsuleRepository.getSources(input.capsuleId);

    this.logger.log(`Capsule updated: ${saved.id}`);
    return saved;
  }
}
