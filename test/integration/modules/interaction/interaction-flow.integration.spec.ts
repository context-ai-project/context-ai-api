/**
 * Integration Test: Complete Interaction Flow (Phase 4)
 *
 * Tests the entire Phase 4 implementation end-to-end:
 * 1. Genkit configuration
 * 2. RAG query flow
 * 3. Conversation persistence
 * 4. Query assistant use case
 * 5. Module integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InteractionModule } from '@modules/interaction/interaction.module';
import { KnowledgeModule } from '@modules/knowledge/knowledge.module';
import { QueryAssistantUseCase } from '@modules/interaction/application/use-cases/query-assistant.use-case';
import { IConversationRepository } from '@modules/interaction/domain/repositories/conversation.repository.interface';
import { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
import { KnowledgeSource } from '@modules/knowledge/domain/entities/knowledge-source.entity';
import { SourceType, SourceStatus } from '@shared/types';
import { KnowledgeFragment } from '@modules/knowledge/domain/entities/fragment.entity';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Phase 4: Interaction Flow Integration Tests', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let queryAssistantUseCase: QueryAssistantUseCase;
  let conversationRepository: IConversationRepository;
  let knowledgeRepository: IKnowledgeRepository;

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const testSectorId = '660e8400-e29b-41d4-a716-446655440001';

  beforeAll(async () => {
    // Create test module with real dependencies
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST || 'localhost',
          port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
          username: process.env.TEST_DB_USERNAME || 'contextai_user',
          password: process.env.TEST_DB_PASSWORD || 'dev_password',
          database: process.env.TEST_DB_DATABASE || 'contextai',
          autoLoadEntities: true,
          synchronize: false,
          logging: false,
        }),
        KnowledgeModule,
        InteractionModule,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    queryAssistantUseCase = module.get<QueryAssistantUseCase>(
      QueryAssistantUseCase,
    );
    conversationRepository = module.get<IConversationRepository>(
      'IConversationRepository',
    );
    knowledgeRepository = module.get<IKnowledgeRepository>(
      'IKnowledgeRepository',
    );

    // Clean test data
    await dataSource.query('DELETE FROM messages WHERE 1=1');
    await dataSource.query('DELETE FROM conversations WHERE 1=1');
    await dataSource.query('DELETE FROM fragments WHERE 1=1');
    await dataSource.query('DELETE FROM knowledge_sources WHERE 1=1');
  });

  afterAll(async () => {
    // Clean test data
    if (dataSource) {
      await dataSource.query('DELETE FROM messages WHERE 1=1');
      await dataSource.query('DELETE FROM conversations WHERE 1=1');
      await dataSource.query('DELETE FROM fragments WHERE 1=1');
      await dataSource.query('DELETE FROM knowledge_sources WHERE 1=1');
      await dataSource.destroy();
    }
    if (module) {
      await module.close();
    }
  });

  describe('Module Integration', () => {
    it('should load InteractionModule with all dependencies', () => {
      expect(module).toBeDefined();
      expect(queryAssistantUseCase).toBeDefined();
      expect(conversationRepository).toBeDefined();
      expect(knowledgeRepository).toBeDefined();
    });

    it('should have QueryAssistantUseCase properly configured', () => {
      expect(queryAssistantUseCase).toBeInstanceOf(QueryAssistantUseCase);
    });
  });

  describe('End-to-End Flow (Mocked RAG)', () => {
    it('should create conversation and persist messages', async () => {
      // Given: Mock knowledge base with test data
      const source = KnowledgeSource.create({
        sectorId: testSectorId,
        title: 'Test Policy',
        url: 'test://policy',
        type: SourceType.MARKDOWN,
        status: SourceStatus.COMPLETED,
        metadata: {},
      });

      await knowledgeRepository.saveSource(source);

      const fragment = KnowledgeFragment.create({
        sourceId: source.id,
        content: 'Vacation requests must be submitted 15 days in advance.',
        embedding: Array(768).fill(0.1), // Mock embedding
        position: 0,
        tokenCount: 10,
        metadata: {},
      });

      await knowledgeRepository.transaction(async () => {
        await knowledgeRepository.saveSource(source);
      });

      // When: User queries the assistant
      const query = 'How do I request vacation?';
      const result = await queryAssistantUseCase.execute({
        userId: testUserId,
        sectorId: testSectorId,
        query,
        maxResults: 5,
        minSimilarity: 0.5,
      });

      // Then: Should receive response with conversation
      expect(result).toBeDefined();
      expect(result.conversationId).toBeDefined();
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify conversation was persisted
      const conversation = await conversationRepository.findById(
        result.conversationId,
      );
      expect(conversation).toBeDefined();
      expect(conversation?.userId).toBe(testUserId);
      expect(conversation?.sectorId).toBe(testSectorId);
      expect(conversation?.messages.length).toBeGreaterThanOrEqual(2); // User + Assistant

      // Verify messages
      const userMessage = conversation?.messages[0];
      expect(userMessage?.content).toBe(query);
      expect(userMessage?.role.value).toBe('user');

      const assistantMessage = conversation?.messages[1];
      expect(assistantMessage?.content).toBe(result.response);
      expect(assistantMessage?.role.value).toBe('assistant');
    }, 30000); // Increased timeout for integration test

    it('should continue existing conversation', async () => {
      // Given: Previous conversation exists
      const firstResult = await queryAssistantUseCase.execute({
        userId: testUserId,
        sectorId: testSectorId,
        query: 'What is the vacation policy?',
        maxResults: 5,
        minSimilarity: 0.5,
      });

      const conversationId = firstResult.conversationId;

      // When: Continue the same conversation
      const secondResult = await queryAssistantUseCase.execute({
        userId: testUserId,
        sectorId: testSectorId,
        query: 'How many days do I get?',
        conversationId,
        maxResults: 5,
        minSimilarity: 0.5,
      });

      // Then: Should use same conversation
      expect(secondResult.conversationId).toBe(conversationId);

      // Verify conversation has 4 messages (2 user + 2 assistant)
      const conversation = await conversationRepository.findById(conversationId);
      expect(conversation?.messages.length).toBeGreaterThanOrEqual(4);
    }, 30000);
  });

  describe('Repository Integration', () => {
    it('should save and retrieve conversations', async () => {
      // This is already tested by the E2E flow above
      // Just verify direct repository access works
      const conversations = await dataSource.query(
        'SELECT COUNT(*) as count FROM conversations WHERE user_id = $1',
        [testUserId],
      );
      expect(parseInt(conversations[0].count, 10)).toBeGreaterThan(0);
    });

    it('should save and retrieve messages', async () => {
      const messages = await dataSource.query(
        'SELECT COUNT(*) as count FROM messages',
      );
      expect(parseInt(messages[0].count, 10)).toBeGreaterThan(0);
    });
  });

  describe('Database Schema', () => {
    it('should have conversations table with correct schema', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'conversations'
        ORDER BY ordinal_position
      `);

      const columns = result.map((r: { column_name: string }) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('sector_id');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
      expect(columns).toContain('deleted_at');
    });

    it('should have messages table with correct schema', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'messages'
        ORDER BY ordinal_position
      `);

      const columns = result.map((r: { column_name: string }) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('conversation_id');
      expect(columns).toContain('role');
      expect(columns).toContain('content');
      expect(columns).toContain('metadata');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have foreign key constraint from messages to conversations', async () => {
      const result = await dataSource.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'messages'
        AND constraint_type = 'FOREIGN KEY'
      `);

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.some((r: { constraint_name: string }) =>
          r.constraint_name.includes('conversation'),
        ),
      ).toBe(true);
    });
  });
});

