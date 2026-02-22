import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionController } from './presentation/interaction.controller';
import { QueryAssistantUseCase } from './application/use-cases/query-assistant.use-case';
import { ConversationRepository } from './infrastructure/persistence/repositories/conversation.repository';
import { ConversationModel } from './infrastructure/persistence/models/conversation.model';
import { MessageModel } from './infrastructure/persistence/models/message.model';
import { createRagQueryService } from '@shared/genkit/flows/rag-query.flow';
import { KnowledgeModule } from '@modules/knowledge/knowledge.module';
import { IVectorStore } from '@modules/knowledge/domain/services/vector-store.interface';
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
 * - Integration with knowledge base via Pinecone vector search
 *
 * Architecture:
 * - Presentation: Controller, DTOs
 * - Application: Use cases
 * - Domain: Entities, repositories (interfaces)
 * - Infrastructure: TypeORM models, repositories (implementations)
 *
 * Dependencies:
 * - KnowledgeModule: For IVectorStore (Pinecone vector search)
 * - TypeORM: For persistence
 * - Genkit: For RAG flow
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationModel, MessageModel]),
    KnowledgeModule, // Import to access IVectorStore
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
        vectorStore: IVectorStore,
      ) => {
        // Create type-safe wrapper for vectorSearch using IVectorStore (Pinecone)
        // Passes minScore through so the RAG flow's minSimilarity reaches Pinecone
        const vectorSearchFn = async (
          embedding: number[],
          sectorId: string,
          limit: number,
          minScore?: number,
        ) => {
          const results = await vectorStore.vectorSearch(
            embedding,
            sectorId,
            limit,
            minScore,
          );

          // Map VectorSearchResult to the format expected by the RAG flow
          return results.map((result) => ({
            id: result.id,
            content: result.metadata.content,
            similarity: result.score,
            sourceId: result.metadata.sourceId,
            metadata: result.metadata as unknown as Record<string, unknown>,
          }));
        };

        // Create RAG query flow service with dependency injection
        const ragQueryService = createRagQueryService(vectorSearchFn);

        return new QueryAssistantUseCase(
          conversationRepository,
          ragQueryService.executeQuery,
        );
      },
      inject: ['IConversationRepository', 'IVectorStore'],
    },
  ],
  exports: ['IConversationRepository'],
})
export class InteractionModule {}
