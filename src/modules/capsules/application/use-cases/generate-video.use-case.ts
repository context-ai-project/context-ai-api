import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { ICapsuleRepository } from '../../domain/repositories/capsule.repository.interface';
import type { ITaskDispatcher } from '../../domain/services/task-dispatcher.interface';
import {
  ScriptGeneratorService,
  type GenerateVideoScriptResult,
} from '../../infrastructure/services/script-generator.service';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

const DEFAULT_MONTHLY_QUOTA = 20;

@Injectable()
export class GenerateVideoUseCase {
  private readonly logger = new Logger(GenerateVideoUseCase.name);
  private readonly monthlyLimit: number;

  constructor(
    @Inject('ICapsuleRepository')
    private readonly capsuleRepo: ICapsuleRepository,
    @Inject('ITaskDispatcher')
    private readonly taskDispatcher: ITaskDispatcher,
    private readonly scriptGenerator: ScriptGeneratorService,
  ) {
    this.monthlyLimit =
      parseInt(process.env.VIDEO_MAX_CAPSULES_PER_MONTH ?? '', 10) ||
      DEFAULT_MONTHLY_QUOTA;
  }

  async execute(capsuleId: string, voiceId: string): Promise<void> {
    this.logger.log(`Generating video for capsule ${capsuleId}`);

    const capsule = await this.capsuleRepo.findById(capsuleId);
    if (!capsule) {
      throw new NotFoundException(`Capsule "${capsuleId}" not found`);
    }

    if (capsule.type !== CapsuleType.VIDEO) {
      throw new Error(
        `Capsule "${capsuleId}" is not a VIDEO capsule (type: ${capsule.type})`,
      );
    }

    const used = await this.capsuleRepo.countVideoCapsulesThisMonth();
    if (used >= this.monthlyLimit) {
      throw new Error(
        `Monthly video capsule quota exhausted (${used}/${this.monthlyLimit})`,
      );
    }

    if (!capsule.script || !capsule.script.trim()) {
      throw new Error(
        `Capsule "${capsuleId}" has no script. Generate a narrative script first.`,
      );
    }

    const result: GenerateVideoScriptResult =
      await this.scriptGenerator.convertScriptToScenes(
        capsule.script,
        capsule.language ?? undefined,
      );

    this.logger.log(
      `Converted narrative to ${result.scenes.length} video scenes for capsule ${capsuleId}`,
    );

    capsule.generationMetadata = {
      ...capsule.generationMetadata,
      scenesJson: result.scriptJson,
    };

    capsule.startGeneration();
    await this.capsuleRepo.save(capsule);

    await this.taskDispatcher.dispatchVideoGeneration({
      capsuleId,
      voiceId,
    });

    this.logger.log(
      `Video generation task dispatched for capsule ${capsuleId}`,
    );
  }

  async getQuotaInfo(): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const used = await this.capsuleRepo.countVideoCapsulesThisMonth();
    return {
      used,
      limit: this.monthlyLimit,
      remaining: Math.max(0, this.monthlyLimit - used),
    };
  }
}
