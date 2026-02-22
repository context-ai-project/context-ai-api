import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { Capsule } from '../../domain/entities/capsule.entity';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

export interface CreateCapsuleInput {
  title: string;
  sectorId: string;
  type: CapsuleType;
  sourceIds: string[];
  createdBy: string;
  introText?: string;
}

/**
 * Create Capsule Use Case
 *
 * Creates a new capsule in DRAFT status and associates the provided
 * knowledge source documents to it.
 *
 * Business rules enforced:
 * - At least one sourceId must be provided
 * - The domain entity validates title length
 * - sectorId and createdBy are set at creation and become immutable
 */
@Injectable()
export class CreateCapsuleUseCase {
  private readonly logger = new Logger(CreateCapsuleUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
  ) {}

  async execute(input: CreateCapsuleInput): Promise<Capsule> {
    this.logger.log(
      `Creating capsule: "${input.title}" for sector ${input.sectorId}`,
    );

    if (!input.sourceIds || input.sourceIds.length === 0) {
      throw new BadRequestException(
        'At least one knowledge source must be selected',
      );
    }

    // Domain entity creation (validates title, etc.)
    const capsule = new Capsule({
      title: input.title,
      sectorId: input.sectorId,
      type: input.type,
      createdBy: input.createdBy,
      introText: input.introText,
    });

    // Persist the DRAFT capsule
    const saved = await this.capsuleRepository.save(capsule);
    if (!saved.id) {
      throw new NotFoundException('Failed to persist capsule');
    }

    // Associate knowledge sources
    await this.capsuleRepository.addSources(saved.id, input.sourceIds);
    saved.sources = await this.capsuleRepository.getSources(saved.id);

    this.logger.log(
      `Capsule created: ${saved.id} with ${input.sourceIds.length} sources`,
    );
    return saved;
  }
}
