import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionController } from './presentation/interaction.controller';
import { QueryAssistantUseCase } from './application/use-cases/query-assistant.use-case';
import { ConversationRepository } from './infrastructure/persistence/repositories/conversation.repository';
import { ConversationModel } from './infrastructure/persistence/models/conversation.model';
import { MessageModel } from './infrastructure/persistence/models/message.model';
import { createRagQueryService } from '@shared/genkit/flows/rag-query.flow';
import { KnowledgeModule } from '@modules/knowledge/knowledge.module';
import { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
import { IConversationRepository } from './domain/repositories/conversation.repository.interface';

/**
 * Interaction Module
 *
 * Handles conversational interactions between users and the RAG assistant.
 *
 * Features:
 * - Query assistant endpoint
 * - Conversation management
 * - Integration with RAG flow
 * - Integration with knowledge base
 *
 * Architecture:
 * - Presentation: Controller, DTOs
 * - Application: Use cases
 * - Domain: Entities, repositories (interfaces)
 * - Infrastructure: TypeORM models, repositories (implementations)
 *
 * Dependencies:
 * - KnowledgeModule: For vector search
 * - TypeORM: For persistence
 * - Genkit: For RAG flow
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationModel, MessageModel]),
    KnowledgeModule, // Import to access KnowledgeRepository
  ],
  controllers: [InteractionController],
  providers: [
    // Repository implementation
    {
      provide: 'IConversationRepository',
      useClass: ConversationRepository,
    },
    // Use case
    {
      provide: QueryAssistantUseCase,
      useFactory: (
        conversationRepository: IConversationRepository,
        knowledgeRepository: IKnowledgeRepository,
      ) => {
        // Create type-safe wrapper for vectorSearch with proper mapping
        const vectorSearchFn = async (
          embedding: number[],
          sectorId: string,
          limit: number,
        ) => {
          const fragments = await knowledgeRepository.vectorSearch(
            embedding,
            sectorId,
            limit,
          );

          // Map to required format with guaranteed non-undefined fields
          return fragments.map((fragment) => ({
            id: fragment.id ?? '',
            content: fragment.content,
            similarity: fragment.similarity,
            sourceId: fragment.sourceId,
            metadata: fragment.metadata,
          }));
        };

        // Create RAG query flow service with dependency injection
        const ragQueryService = createRagQueryService(vectorSearchFn);

        return new QueryAssistantUseCase(
          conversationRepository,
          ragQueryService.executeQuery,
        );
      },
      inject: ['IConversationRepository', 'IKnowledgeRepository'],
    },
  ],
  exports: ['IConversationRepository'],
})
export class InteractionModule {}
