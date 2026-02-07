import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { InteractionModule } from '@modules/interaction/interaction.module';
import { KnowledgeModule } from '@modules/knowledge/knowledge.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueryAssistantUseCase } from '@modules/interaction/application/use-cases/query-assistant.use-case';
import { InteractionController } from '@modules/interaction/presentation/interaction.controller';
import { IConversationRepository } from '@modules/interaction/domain/repositories/conversation.repository.interface';
import { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
import databaseConfig from '@config/database.config';

/**
 * Integration Test: InteractionModule
 *
 * Verifies that all Phase 4 components are properly integrated:
 * - Module loading
 * - Dependency injection
 * - Service instantiation
 * - Controller availability
 */
describe('InteractionModule Integration', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig],
          envFilePath: ['.env.test', '.env'],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const dbConfig = configService.get('database');
            return {
              ...dbConfig,
              synchronize: false,
              logging: false,
            };
          },
          inject: [ConfigService],
        }),
        KnowledgeModule,
        InteractionModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  describe('Module Loading', () => {
    it('should load InteractionModule successfully', () => {
      expect(moduleRef).toBeDefined();
    });

    it('should load KnowledgeModule as dependency', () => {
      const knowledgeRepo = moduleRef.get<IKnowledgeRepository>(
        'IKnowledgeRepository',
      );
      expect(knowledgeRepo).toBeDefined();
    });
  });

  describe('Controller Registration', () => {
    it('should register InteractionController', () => {
      const controller = moduleRef.get<InteractionController>(
        InteractionController,
      );
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(InteractionController);
    });

    it('should have query method in controller', () => {
      const controller = moduleRef.get<InteractionController>(
        InteractionController,
      );
      expect(typeof controller.query).toBe('function');
    });
  });

  describe('Use Case Registration', () => {
    it('should register QueryAssistantUseCase', () => {
      const useCase = moduleRef.get<QueryAssistantUseCase>(
        QueryAssistantUseCase,
      );
      expect(useCase).toBeDefined();
      expect(useCase).toBeInstanceOf(QueryAssistantUseCase);
    });

    it('should have execute method in use case', () => {
      const useCase = moduleRef.get<QueryAssistantUseCase>(
        QueryAssistantUseCase,
      );
      expect(typeof useCase.execute).toBe('function');
    });
  });

  describe('Repository Registration', () => {
    it('should register IConversationRepository', () => {
      const repository = moduleRef.get<IConversationRepository>(
        'IConversationRepository',
      );
      expect(repository).toBeDefined();
    });

    it('should have required repository methods', () => {
      const repository = moduleRef.get<IConversationRepository>(
        'IConversationRepository',
      );
      expect(typeof repository.save).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findByUserIdAndSectorId).toBe('function');
      expect(typeof repository.softDelete).toBe('function');
      expect(typeof repository.findMessagesByConversationId).toBe('function');
      expect(typeof repository.transaction).toBe('function');
    });
  });

  describe('Dependency Injection Chain', () => {
    it('should inject ConversationRepository into UseCase', () => {
      const useCase = moduleRef.get<QueryAssistantUseCase>(
        QueryAssistantUseCase,
      );
      expect(useCase).toBeDefined();
      // If we reach here, DI worked
    });

    it('should inject KnowledgeRepository for RAG flow', () => {
      const knowledgeRepo = moduleRef.get<IKnowledgeRepository>(
        'IKnowledgeRepository',
      );
      expect(knowledgeRepo).toBeDefined();
      expect(typeof knowledgeRepo.vectorSearch).toBe('function');
    });

    it('should inject UseCase into Controller', () => {
      const controller = moduleRef.get<InteractionController>(
        InteractionController,
      );
      expect(controller).toBeDefined();
      // If we reach here, DI chain is complete
    });
  });

  describe('Type Safety Validation', () => {
    it('should have properly typed ConversationRepository', () => {
      const repository = moduleRef.get<IConversationRepository>(
        'IConversationRepository',
      );
      expect(repository).toBeDefined();
      // TypeScript compilation ensures type safety
    });

    it('should have properly typed KnowledgeRepository', () => {
      const knowledgeRepo = moduleRef.get<IKnowledgeRepository>(
        'IKnowledgeRepository',
      );
      expect(knowledgeRepo).toBeDefined();
      expect(knowledgeRepo.vectorSearch).toBeDefined();
    });
  });
});

