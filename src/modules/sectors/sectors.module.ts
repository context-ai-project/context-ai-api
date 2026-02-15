import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Presentation
import { SectorController } from './presentation/sector.controller';

// Application - Use Cases
import { CreateSectorUseCase } from './application/use-cases/create-sector.use-case';
import { UpdateSectorUseCase } from './application/use-cases/update-sector.use-case';
import { DeleteSectorUseCase } from './application/use-cases/delete-sector.use-case';
import { ToggleSectorStatusUseCase } from './application/use-cases/toggle-sector-status.use-case';

// Infrastructure - Persistence
import { SectorModel } from './infrastructure/persistence/models/sector.model';
import { SectorRepository } from './infrastructure/persistence/repositories/sector.repository';

// Knowledge Module (for document count checking)
import { KnowledgeModule } from '../knowledge/knowledge.module';

/**
 * Sectors Module
 *
 * Manages the lifecycle of knowledge sectors.
 * Implements Clean Architecture with clear layer separation.
 *
 * Layers:
 * - Presentation: Controller (HTTP endpoints)
 * - Application: Use Cases (create, update, delete, toggle status)
 * - Domain: Entity, Repository Interface
 * - Infrastructure: TypeORM model, mapper, repository
 *
 * Dependencies:
 * - KnowledgeModule: For checking document count before sector deletion
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SectorModel]),
    KnowledgeModule, // Provides 'IKnowledgeRepository' for document count checks
  ],
  controllers: [SectorController],
  providers: [
    // Application Layer - Use Cases
    CreateSectorUseCase,
    UpdateSectorUseCase,
    DeleteSectorUseCase,
    ToggleSectorStatusUseCase,

    // Infrastructure Layer - Repository with interface token
    {
      provide: 'ISectorRepository',
      useClass: SectorRepository,
    },
  ],
  exports: [
    // Export repository for other modules that might need sector data
    'ISectorRepository',
  ],
})
export class SectorsModule {}
