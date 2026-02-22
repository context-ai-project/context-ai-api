import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Presentation
import { CapsulesController } from './presentation/capsules.controller';

// Application — Use Cases (CRUD + lifecycle)
import { CreateCapsuleUseCase } from './application/use-cases/create-capsule.use-case';
import { ListCapsulesUseCase } from './application/use-cases/list-capsules.use-case';
import { GetCapsuleUseCase } from './application/use-cases/get-capsule.use-case';
import { UpdateCapsuleUseCase } from './application/use-cases/update-capsule.use-case';
import { DeleteCapsuleUseCase } from './application/use-cases/delete-capsule.use-case';
import { PublishCapsuleUseCase } from './application/use-cases/publish-capsule.use-case';
import { ArchiveCapsuleUseCase } from './application/use-cases/archive-capsule.use-case';

// Infrastructure — Persistence
import { CapsuleModel } from './infrastructure/persistence/models/capsule.model';
import { CapsuleGenerationLogModel } from './infrastructure/persistence/models/capsule-generation-log.model';
import { CapsuleRepository } from './infrastructure/persistence/repositories/capsule.repository';

/**
 * Capsules Module (v2 — Block A: Audio Capsules)
 *
 * Implements Clean Architecture with strict layer separation:
 * - Presentation: HTTP controller
 * - Application: Use cases (CRUD, lifecycle transitions)
 * - Domain: Capsule entity + repository interface
 * - Infrastructure: TypeORM repository implementation
 *
 * Generation pipeline services (GenerateScript, GenerateAudio with
 * ElevenLabs TTS and GCS storage) are added in Fase 2c once the
 * external service adapters are implemented.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CapsuleModel, CapsuleGenerationLogModel]),
  ],
  controllers: [CapsulesController],
  providers: [
    // Application Layer — Use Cases
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    UpdateCapsuleUseCase,
    DeleteCapsuleUseCase,
    PublishCapsuleUseCase,
    ArchiveCapsuleUseCase,

    // Infrastructure Layer — Repository (DIP token)
    {
      provide: 'ICapsuleRepository',
      useClass: CapsuleRepository,
    },
  ],
  exports: [
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    'ICapsuleRepository',
  ],
})
export class CapsulesModule {}
