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
import { GenerateScriptUseCase } from './application/use-cases/generate-script.use-case';
import { GenerateAudioUseCase } from './application/use-cases/generate-audio.use-case';

// Infrastructure — Persistence
import { CapsuleModel } from './infrastructure/persistence/models/capsule.model';
import { CapsuleGenerationLogModel } from './infrastructure/persistence/models/capsule-generation-log.model';
import { CapsuleRepository } from './infrastructure/persistence/repositories/capsule.repository';

// Infrastructure — External Services
import { ElevenLabsAudioService } from './infrastructure/services/elevenlabs-audio.service';
import { GcsStorageService } from './infrastructure/services/gcs-storage.service';
import { ScriptGeneratorService } from './infrastructure/services/script-generator.service';

// External modules — for RAG + vector search
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { EmbeddingService } from '../knowledge/infrastructure/services/embedding.service';

/**
 * Capsules Module (v2 — Block A: Audio Capsules)
 *
 * Implements Clean Architecture with strict layer separation:
 * - Presentation: HTTP controller
 * - Application: Use cases (CRUD, lifecycle transitions, generation pipeline)
 * - Domain: Capsule entity + repository/service interfaces
 * - Infrastructure: TypeORM repository, ElevenLabs TTS, GCS storage, Gemini script generator
 *
 * External dependencies:
 * - KnowledgeModule: provides 'IVectorStore' (PineconeVectorStore) and EmbeddingService
 *   for RAG context retrieval during script generation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CapsuleModel, CapsuleGenerationLogModel]),
    // Re-export of PineconeModule is included — provides 'IVectorStore' token
    KnowledgeModule,
  ],
  controllers: [CapsulesController],
  providers: [
    // Application Layer — Use Cases (CRUD)
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    UpdateCapsuleUseCase,
    DeleteCapsuleUseCase,
    PublishCapsuleUseCase,
    ArchiveCapsuleUseCase,

    // Application Layer — Use Cases (Generation pipeline)
    GenerateScriptUseCase,
    GenerateAudioUseCase,

    // Infrastructure Layer — Repository (DIP token)
    {
      provide: 'ICapsuleRepository',
      useClass: CapsuleRepository,
    },

    // Infrastructure Layer — External service adapters (DIP tokens)
    {
      provide: 'IAudioGenerator',
      useClass: ElevenLabsAudioService,
    },
    {
      provide: 'IMediaStorage',
      useClass: GcsStorageService,
    },

    // Infrastructure Layer — Script generation service
    ScriptGeneratorService,

    // EmbeddingService from KnowledgeModule re-registered for ScriptGeneratorService injection
    EmbeddingService,
  ],
  exports: [
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    'ICapsuleRepository',
  ],
})
export class CapsulesModule {}
