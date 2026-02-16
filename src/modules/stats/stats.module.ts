import { Module } from '@nestjs/common';

// Presentation
import { StatsController } from './presentation/stats.controller';

// Dependent modules (provide repositories via DI tokens)
import { UsersModule } from '../users/users.module';
import { InteractionModule } from '../interaction/interaction.module';
import { SectorsModule } from '../sectors/sectors.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

/**
 * Stats Module
 *
 * Provides aggregated platform statistics for the admin dashboard.
 * No domain or persistence of its own – only reads from other modules.
 *
 * Dependencies:
 * - UsersModule:       UserRepository (countAll, countRecent)
 * - InteractionModule: IConversationRepository (countAll)
 * - SectorsModule:     ISectorRepository (findAll)
 * - KnowledgeModule:   IKnowledgeRepository (findAllSources)
 */
@Module({
  imports: [UsersModule, InteractionModule, SectorsModule, KnowledgeModule],
  controllers: [StatsController],
})
export class StatsModule {}
