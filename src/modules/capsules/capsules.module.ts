import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Presentation
import { CapsulesController } from './presentation/capsules.controller';
import { InternalCapsulesController } from './presentation/internal-capsules.controller';

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
import { GenerateVideoUseCase } from './application/use-cases/generate-video.use-case';

// Application — Services
import { VideoPipelineService } from './application/services/video-pipeline.service';

// Infrastructure — Persistence
import { CapsuleModel } from './infrastructure/persistence/models/capsule.model';
import { CapsuleGenerationLogModel } from './infrastructure/persistence/models/capsule-generation-log.model';
import { CapsuleRepository } from './infrastructure/persistence/repositories/capsule.repository';

// Infrastructure — External Services
import { ElevenLabsAudioService } from './infrastructure/services/elevenlabs-audio.service';
import { GcsStorageService } from './infrastructure/services/gcs-storage.service';
import { Imagen3ImageGeneratorService } from './infrastructure/services/imagen3-image-generator.service';
import { ShotstackRendererService } from './infrastructure/services/shotstack-renderer.service';
import { CloudTasksDispatcher } from './infrastructure/services/cloud-tasks-dispatcher.service';
import { LocalTaskDispatcher } from './infrastructure/services/local-task-dispatcher.service';
import { ScriptGeneratorService } from './infrastructure/services/script-generator.service';

// External modules — for RAG + vector search
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { EmbeddingService } from '../knowledge/infrastructure/services/embedding.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Auth guard for internal webhook
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';

/**
 * Capsules Module (v2 — Block A: Audio + Block B: Video)
 *
 * Implements Clean Architecture with strict layer separation:
 * - Presentation: HTTP controllers (public + internal webhook)
 * - Application: Use cases + VideoPipelineService
 * - Domain: Capsule entity + repository/service interfaces
 * - Infrastructure: TypeORM, ElevenLabs TTS, Imagen 3, Shotstack, Cloud Tasks, GCS
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CapsuleModel, CapsuleGenerationLogModel]),
    KnowledgeModule,
    NotificationsModule,
  ],
  controllers: [CapsulesController, InternalCapsulesController],
  providers: [
    // Application Layer — Use Cases (CRUD)
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    UpdateCapsuleUseCase,
    DeleteCapsuleUseCase,
    PublishCapsuleUseCase,
    ArchiveCapsuleUseCase,

    // Application Layer — Use Cases (Generation pipelines)
    GenerateScriptUseCase,
    GenerateAudioUseCase,
    GenerateVideoUseCase,

    // Application Layer — Services
    {
      provide: 'VideoPipelineService',
      useClass: VideoPipelineService,
    },
    VideoPipelineService,

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
    {
      provide: 'IImageGenerator',
      useClass: Imagen3ImageGeneratorService,
    },
    {
      provide: 'IVideoRenderer',
      useClass: ShotstackRendererService,
    },
    {
      provide: 'ITaskDispatcher',
      useClass:
        process.env.NODE_ENV === 'production'
          ? CloudTasksDispatcher
          : LocalTaskDispatcher,
    },

    // Infrastructure Layer — Script generation service
    ScriptGeneratorService,

    // EmbeddingService from KnowledgeModule re-registered for ScriptGeneratorService injection
    EmbeddingService,

    // Auth guard for internal webhook
    InternalApiKeyGuard,
  ],
  exports: [
    CreateCapsuleUseCase,
    ListCapsulesUseCase,
    GetCapsuleUseCase,
    'ICapsuleRepository',
  ],
})
export class CapsulesModule {}
