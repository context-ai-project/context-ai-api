import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { SourceType, SourceStatus } from '@shared/types';
import { KnowledgeRepository } from '../../src/modules/knowledge/infrastructure/persistence/repositories/knowledge.repository';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDefaultTestPdf } from '../fixtures/create-test-pdf';

// Mock Genkit to avoid real API calls
const mockEmbedFn = jest.fn();
const mockGenkit = {
  embed: mockEmbedFn,
};

jest.mock('genkit', () => ({
  genkit: jest.fn(() => mockGenkit),
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: jest.fn(),
}));

// Mock pdfjs-dist to prevent import.meta errors
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn().mockImplementation((options: { data: Uint8Array }) => {
    const bufferString = Buffer.from(options.data).toString(
      'utf-8',
      0,
      Math.min(options.data.length, 50),
    );

    if (!bufferString.startsWith('%PDF')) {
      return {
        promise: Promise.reject(new Error('Invalid or corrupted PDF')),
      };
    }

    // Extract text from simple test PDF
    const fullBuffer = Buffer.from(options.data).toString('utf-8');
    const match = fullBuffer.match(/\((.*?)\)/);
    const text = match ? match[1] : 'Test PDF content';

    return {
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getTextContent: jest.fn().mockResolvedValue({
            items: [{ str: text }],
          }),
        }),
        getMetadata: jest.fn().mockResolvedValue({
          info: {
            Title: 'Test PDF',
            Creator: 'Test Suite',
          },
        }),
      }),
    };
  }),
}));

describe('Document Ingestion E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let repository: KnowledgeRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes (same as main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    repository = moduleFixture.get<KnowledgeRepository>(KnowledgeRepository);

    // Setup embedding mock (3072 dimensions for text-embedding-004)
    const mockEmbedding = Array(3072).fill(0.1);
    mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.query('SET session_replication_role = replica;');
    await dataSource.query('TRUNCATE knowledge_sources, fragments CASCADE;');
    await dataSource.query('SET session_replication_role = DEFAULT;');
    jest.clearAllMocks();
  });

  describe('POST /api/v1/knowledge/documents/upload', () => {
    const validSectorId = '550e8400-e29b-41d4-a716-446655440000';

    it('should successfully ingest a Markdown document', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Test Markdown Document')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.MARKDOWN)
        .attach('file', markdownContent, {
          filename: 'test-document.md',
          contentType: 'text/markdown',
        });

      // Assert HTTP Response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sourceId');
      expect(response.body).toHaveProperty('status', SourceStatus.COMPLETED);
      expect(response.body).toHaveProperty('fragmentCount');
      expect(response.body.fragmentCount).toBeGreaterThan(0);

      // Verify database persistence (relational data)
      const source = await repository.findSourceById(response.body.sourceId);
      expect(source).toBeDefined();
      expect(source!.title).toBe('Test Markdown Document');
      expect(source!.status).toBe(SourceStatus.COMPLETED);

      // Verify fragments were saved (without embeddings - those are in Pinecone)
      const fragments = await repository.findFragmentsBySource(
        response.body.sourceId,
      );
      expect(fragments.length).toBe(response.body.fragmentCount);
      expect(fragments[0].content).toBeDefined();
      expect(fragments[0].position).toBe(0);
    });

    it('should successfully ingest a PDF document', async () => {
      // Arrange
      const pdfBuffer = createDefaultTestPdf();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Test PDF Document')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.PDF)
        .attach('file', pdfBuffer, {
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
        });

      // Assert HTTP Response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sourceId');
      expect(response.body.status).toBe(SourceStatus.COMPLETED);

      // Verify database persistence
      const source = await repository.findSourceById(response.body.sourceId);
      expect(source).toBeDefined();
      expect(source!.sourceType).toBe(SourceType.PDF);
    });

    it('should handle metadata in document upload', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);
      const metadata = {
        author: 'Test Author',
        department: 'Engineering',
        version: '1.0',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Document with Metadata')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.MARKDOWN)
        .field('metadata', JSON.stringify(metadata))
        .attach('file', markdownContent, {
          filename: 'test-document.md',
          contentType: 'text/markdown',
        });

      // Assert
      expect(response.status).toBe(201);

      const source = await repository.findSourceById(response.body.sourceId);
      expect(source!.metadata).toMatchObject(metadata);
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);

      // Act - Missing title
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.MARKDOWN)
        .attach('file', markdownContent, {
          filename: 'test-document.md',
          contentType: 'text/markdown',
        });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid sector ID', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Test Document')
        .field('sectorId', 'invalid-uuid')
        .field('sourceType', SourceType.MARKDOWN)
        .attach('file', markdownContent, {
          filename: 'test-document.md',
          contentType: 'text/markdown',
        });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing file', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Test Document')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.MARKDOWN);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should handle file size validation', async () => {
      // Arrange - Create a large buffer (>10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Large Document')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.PDF)
        .attach('file', largeBuffer, {
          filename: 'large-document.pdf',
          contentType: 'application/pdf',
        });

      // Assert
      expect(response.status).toBe(400);
    });

    // Note: Vector search E2E tests have been moved to Phase 6B.6
    // as they now require Pinecone integration (IVectorStore)

    it('should create multiple fragments from long document', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .field('title', 'Long Document Test')
        .field('sectorId', validSectorId)
        .field('sourceType', SourceType.MARKDOWN)
        .attach('file', markdownContent, {
          filename: 'test-document.md',
          contentType: 'text/markdown',
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.fragmentCount).toBeGreaterThan(1);

      // Verify fragments are ordered correctly
      const fragments = await repository.findFragmentsBySource(
        response.body.sourceId,
      );
      for (let i = 0; i < fragments.length - 1; i++) {
        expect(fragments[i].position).toBeLessThan(fragments[i + 1].position);
      }
    });

    it('should handle concurrent document uploads', async () => {
      // Arrange
      const markdownPath = join(__dirname, '../fixtures/test-document.md');
      const markdownContent = readFileSync(markdownPath);

      // Act - Upload 3 documents concurrently
      const uploadPromises = Array.from({ length: 3 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/v1/knowledge/documents/upload')
          .field('title', `Concurrent Test ${index}`)
          .field('sectorId', validSectorId)
          .field('sourceType', SourceType.MARKDOWN)
          .attach('file', markdownContent, {
            filename: `test-document-${index}.md`,
            contentType: 'text/markdown',
          }),
      );

      const responses = await Promise.all(uploadPromises);

      // Assert
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe(SourceStatus.COMPLETED);
      });

      // Verify all sources were created
      const sources = await repository.findSourcesBySector(validSectorId);
      expect(sources.length).toBe(3);
    });
  });
});
