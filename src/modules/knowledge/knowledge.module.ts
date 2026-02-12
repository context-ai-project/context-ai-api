import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Presentation
import { KnowledgeController } from './presentation/knowledge.controller';

// Application
import { IngestDocumentUseCase } from './application/use-cases/ingest-document.use-case';
import { DeleteSourceUseCase } from './application/use-cases/delete-source.use-case';

// Infrastructure - Services
import { DocumentParserService } from './infrastructure/services/document-parser.service';
import { ChunkingService } from './infrastructure/services/chunking.service';
import { EmbeddingService } from './infrastructure/services/embedding.service';

// Infrastructure - Persistence
import { KnowledgeSourceModel } from './infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from './infrastructure/persistence/models/fragment.model';
import { KnowledgeRepository } from './infrastructure/persistence/repositories/knowledge.repository';

// Infrastructure - Pinecone
import { PineconeModule } from './infrastructure/pinecone/pinecone.module';

/**
 * Knowledge Module
 *
 * Orchestrates all components of the Knowledge Context bounded context.
 * Implements Clean Architecture with clear layer separation.
 *
 * Layers:
 * - Presentation: Controllers (HTTP endpoints)
 * - Application: Use Cases (business workflows)
 * - Domain: Entities, Value Objects, Repository Interfaces
 * - Infrastructure: Services, Persistence, External APIs
 *
 * Dependencies are injected following Dependency Inversion Principle:
 * - Use Cases depend on Repository Interfaces (not implementations)
 * - Use Cases depend on IVectorStore Interface (not PineconeVectorStore directly)
 * - Controllers depend on Use Cases (not directly on services)
 *
 * Vector Operations:
 * - PostgreSQL: Relational data (sources, fragments metadata)
 * - Pinecone: Vector embeddings (via IVectorStore)
 */
@Module({
  imports: [
    // Register TypeORM models
    TypeOrmModule.forFeature([KnowledgeSourceModel, FragmentModel]),
    // Pinecone vector store module (provides Pinecone client and PineconeVectorStore)
    PineconeModule,
  ],
  controllers: [
    // Presentation Layer
    KnowledgeController,
  ],
  providers: [
    // Application Layer - Use Cases
    IngestDocumentUseCase,
    DeleteSourceUseCase,

    // Infrastructure Layer - Services
    DocumentParserService,
    ChunkingService,
    EmbeddingService,

    // Infrastructure Layer - Repository Implementation with interface token
    {
      provide: 'IKnowledgeRepository',
      useClass: KnowledgeRepository,
    },

    // Note: 'IVectorStore' is provided by PineconeModule (imported above)
    // No need to re-register it here
  ],
  exports: [
    // Export use cases for other modules if needed
    IngestDocumentUseCase,
    DeleteSourceUseCase,
    // Export repository with interface token
    'IKnowledgeRepository',
    // Re-export PineconeModule so other modules can access 'IVectorStore'
    PineconeModule,
  ],
})
export class KnowledgeModule {}
