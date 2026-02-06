# Testing Guidelines

This document describes testing standards and practices for Context.AI API.

---

## 🎯 Test Coverage Target: 100%

All code must have corresponding tests. No exceptions.

---

## 📋 Test Types

### 1. Unit Tests (`test/unit/`)

**Purpose**: Test individual components in isolation

**Characteristics**:
- Mock all external dependencies
- Fast execution (< 1s per test)
- Focus on business logic
- Test edge cases and error handling

**Example Structure**:
```typescript
describe('IngestDocumentUseCase', () => {
  let useCase: IngestDocumentUseCase;
  let mockParser: jest.Mocked<DocumentParserService>;
  let mockChunking: jest.Mocked<ChunkingService>;
  let mockEmbedding: jest.Mocked<EmbeddingService>;
  let mockRepository: jest.Mocked<IKnowledgeRepository>;

  beforeEach(() => {
    mockParser = {
      parse: jest.fn(),
    } as jest.Mocked<DocumentParserService>;

    mockChunking = {
      chunkText: jest.fn(),
    } as jest.Mocked<ChunkingService>;

    mockEmbedding = {
      generateEmbeddings: jest.fn(),
    } as jest.Mocked<EmbeddingService>;

    mockRepository = {
      save: jest.fn(),
      saveFragments: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<IKnowledgeRepository>;

    useCase = new IngestDocumentUseCase(
      mockParser,
      mockChunking,
      mockEmbedding,
      mockRepository,
    );
  });

  describe('execute', () => {
    it('should successfully ingest document', async () => {
      // Arrange
      const dto = createTestDto();
      const parsedDoc = createParsedDoc();
      const chunks = ['chunk1', 'chunk2'];
      const embeddings = [[0.1, 0.2], [0.3, 0.4]];

      mockParser.parse.mockResolvedValue(parsedDoc);
      mockChunking.chunkText.mockReturnValue(chunks);
      mockEmbedding.generateEmbeddings.mockResolvedValue(embeddings);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.sourceId).toBeDefined();
      expect(result.fragmentsCreated).toBe(2);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle parsing error', async () => {
      // Arrange
      mockParser.parse.mockRejectedValue(new Error('Parse failed'));

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow('Parse failed');
    });
  });
});
```

### 2. Integration Tests (`test/integration/`)

**Purpose**: Test component interactions with real database

**Characteristics**:
- Use test database instance
- Test TypeORM repositories
- Verify data persistence
- Test transactions and rollbacks

**Setup**:
```typescript
describe('KnowledgeRepository Integration', () => {
  let dataSource: DataSource;
  let repository: KnowledgeRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await clearDatabase(dataSource);
    repository = new KnowledgeRepository(
      dataSource.getRepository(KnowledgeSourceModel),
      dataSource.getRepository(FragmentModel),
    );
  });

  it('should save and retrieve knowledge source', async () => {
    // Arrange
    const source = createTestSource();

    // Act
    const saved = await repository.save(source);
    const retrieved = await repository.findById(saved.id);

    // Assert
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe(source.title);
  });
});
```

### 3. E2E Tests (`test/e2e/`)

**Purpose**: Test complete user flows through HTTP API

**Characteristics**:
- Start full NestJS application
- Test real HTTP requests
- Validate full system integration
- Test authentication and authorization

**Example**:
```typescript
describe('Document Ingestion E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(await createTestDataSource())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  it('/api/knowledge/upload (POST)', async () => {
    // Arrange
    const pdfBuffer = await fs.readFile('test/fixtures/sample.pdf');

    // Act
    const response = await request(app.getHttpServer())
      .post('/api/knowledge/upload')
      .attach('file', pdfBuffer, 'sample.pdf')
      .field('title', 'Test Document')
      .field('sectorId', 'sector-123')
      .field('sourceType', 'PDF')
      .expect(201);

    // Assert
    expect(response.body.sourceId).toBeDefined();
    expect(response.body.fragmentsCreated).toBeGreaterThan(0);
  });
});
```

---

## 🎯 Test Organization (AAA Pattern)

Always use **Arrange-Act-Assert** pattern:

```typescript
it('should do something', async () => {
  // Arrange - Set up test data and mocks
  const input = createTestInput();
  mockService.method.mockResolvedValue(expectedValue);

  // Act - Execute the code under test
  const result = await service.methodUnderTest(input);

  // Assert - Verify the outcome
  expect(result).toEqual(expectedValue);
  expect(mockService.method).toHaveBeenCalledWith(input);
});
```

---

## 🛠️ Mocking Best Practices

### Module-Level Mocks

```typescript
// Mock external libraries at module level
jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((buffer: Buffer) => {
    return Promise.resolve({
      text: 'Mocked PDF content',
      numpages: 1,
      info: { Title: 'Test PDF' },
    });
  }),
}));
```

### Service Mocks

```typescript
// Create type-safe mocks
const mockService: jest.Mocked<ServiceType> = {
  method1: jest.fn(),
  method2: jest.fn(),
} as jest.Mocked<ServiceType>;
```

### Repository Mocks

```typescript
const mockRepository: jest.Mocked<IKnowledgeRepository> = {
  save: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.Mocked<IKnowledgeRepository>;
```

---

## ✅ Test Naming Conventions

### Describe Blocks
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {});
    it('should throw error when invalid input', () => {});
  });
});
```

### Test Names
Use this format: `should [expected behavior] when [condition]`

**Examples**:
- ✅ `should return source when valid id provided`
- ✅ `should throw error when source not found`
- ✅ `should generate embeddings for all chunks`
- ❌ `test source retrieval` (too vague)
- ❌ `it works` (not descriptive)

---

## 🧪 Test Commands

```bash
# Run all tests
pnpm test

# Run with coverage report
pnpm test:cov

# Run in watch mode (for TDD)
pnpm test:watch

# Run specific test file
pnpm test path/to/test.spec.ts

# Run only unit tests
pnpm test --testPathPattern=test/unit

# Run only integration tests
pnpm test:integration

# Run only E2E tests
pnpm test:e2e

# Run tests in debug mode
pnpm test:debug
```

---

## 🎭 Test Data Factories

Create reusable test data factories:

```typescript
// test/helpers/factories.ts
export function createTestKnowledgeSource(
  overrides?: Partial<KnowledgeSource>
): KnowledgeSource {
  return new KnowledgeSource({
    title: 'Test Source',
    sectorId: 'sector-123',
    sourceType: SourceType.PDF,
    content: 'Test content',
    ...overrides,
  });
}

export function createTestIngestDto(
  overrides?: Partial<IngestDocumentDto>
): IngestDocumentDto {
  return {
    title: 'Test Document',
    sectorId: 'sector-123',
    sourceType: SourceType.PDF,
    buffer: Buffer.from('test'),
    ...overrides,
  };
}
```

---

## 🔍 Coverage Requirements

**Minimum Coverage**:
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

**Configuration** (`jest.config.js`):
```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
```

---

## 🚫 What NOT to Test

1. ❌ Third-party libraries (trust they're tested)
2. ❌ TypeORM generated methods (basic CRUD)
3. ❌ Simple getters/setters without logic
4. ❌ Interfaces/types (TypeScript handles this)

**DO test**:
- ✅ Business logic
- ✅ Custom validations
- ✅ Error handling
- ✅ Edge cases
- ✅ Integration points
- ✅ API endpoints

---

## 🐛 Debugging Tests

```bash
# Run single test with console output
pnpm test -t "test name" --verbose

# Debug with Node inspector
pnpm test:debug

# Then open chrome://inspect in Chrome
```

---

## 📊 Coverage Reports

After running `pnpm test:cov`, view the report:

```bash
# Open HTML report
open coverage/lcov-report/index.html
```

---

## 🔄 TDD Workflow

1. **RED**: Write a failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code while keeping tests green

```bash
# Start watch mode
pnpm test:watch

# Edit test file → See it fail (RED)
# Edit source file → See it pass (GREEN)
# Refactor → Keep tests green
```

---

## 📚 Additional Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Testing Best Practices**: https://github.com/goldbergyoni/javascript-testing-best-practices
- **Test-Driven Development**: Kent Beck's TDD book

