import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import { ScriptGeneratorService } from '../../infrastructure/services/script-generator.service';

/**
 * Generate Script Use Case
 *
 * Retrieves relevant document fragments from Pinecone (RAG) and
 * generates a plain-text narrative script using Gemini 2.5 Flash.
 * The script is always user-friendly narrative text for both AUDIO
 * and VIDEO capsules. For VIDEO, the conversion to structured scenes
 * happens later in the video generation pipeline.
 */
@Injectable()
export class GenerateScriptUseCase {
  private readonly logger = new Logger(GenerateScriptUseCase.name);

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepository: ICapsuleRepository,
    private readonly scriptGenerator: ScriptGeneratorService,
  ) {}

  async execute(
    capsuleId: string,
    language?: string,
  ): Promise<{ script: string }> {
    this.logger.log(`Generating script for capsule: ${capsuleId}`);

    const capsule = await this.capsuleRepository.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule with ID "${capsuleId}" not found`);
    }

    if (!capsule.canGenerateScript()) {
      throw new Error(
        `Cannot generate script for capsule in status "${capsule.status}". ` +
          `Allowed: DRAFT, COMPLETED, FAILED`,
      );
    }

    const sources = await this.capsuleRepository.getSources(capsuleId);
    const sourceIds = sources.map((s) => s.id);

    const result = await this.scriptGenerator.generate({
      sourceIds,
      sectorId: capsule.sectorId,
      introText: capsule.introText,
      language,
    });

    capsule.updateScript(result.script, result.description, language);
    await this.capsuleRepository.save(capsule);

    this.logger.log(`Script generated and saved for capsule: ${capsuleId}`);

    return { script: result.script };
  }
}
