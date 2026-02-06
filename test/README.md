# 🧪 Testing Guide for Context.ai API

This document provides comprehensive information about the testing strategy, how to run tests, and best practices for testing the Context.ai API.

## 📋 **Table of Contents**

1. [Testing Strategy](#testing-strategy)
2. [Test Types](#test-types)
3. [Prerequisites](#prerequisites)
4. [Running Tests](#running-tests)
5. [Test Structure](#test-structure)
6. [Writing New Tests](#writing-new-tests)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 **Testing Strategy**

The Context.ai API follows a comprehensive testing strategy based on the Test Pyramid:

```
         ╱╲
        ╱E2E╲          ← Few, slow, high-level
       ╱──────╲
      ╱ Integ. ╲       ← More, medium speed
     ╱──────────╲
    ╱    Unit     ╲    ← Many, fast, isolated
   ╱──────────────╲
```

### **Test Distribution**
- **Unit Tests (~70%)**: Fast, isolated tests for individual components
- **Integration Tests (~20%)**: Tests with real database connections
- **End-to-End Tests (~10%)**: Full system tests with HTTP requests

---

## 🔬 **Test Types**

### **1. Unit Tests**
- **Location**: `test/unit/**/*.spec.ts`
- **Purpose**: Test individual classes, methods, and functions in isolation
- **Speed**: Very fast (milliseconds)
- **Dependencies**: Mocked
- **Coverage Target**: >80%

**Example**:
```typescript
describe('KnowledgeSource Entity', () => {
  it('should create entity with valid data', () => {
    const source = new KnowledgeSource({ ... });
    expect(source.title).toBe('Test Document');
  });
});
```

### **2. Integration Tests**
- **Location**: `test/integration/**/*.spec.ts`
- **Purpose**: Test interactions with real PostgreSQL database
- **Speed**: Medium (seconds)
- **Dependencies**: Real database (PostgreSQL + pgvector)
- **Database**: `context_ai_test` (separate from development)

**Example**:
```typescript
describe('KnowledgeRepository Integration', () => {
  it('should perform vector search', async () => {
    const results = await repository.vectorSearch(embedding, 5);
    expect(results[0]).toHaveProperty('similarity');
  });
});
```

### **3. End-to-End (E2E) Tests**
- **Location**: `test/e2e/**/*.e2e-spec.ts`
- **Purpose**: Test complete user workflows from HTTP request to database
- **Speed**: Slow (seconds to minutes)
- **Dependencies**: Full NestJS app + real database
- **Server**: Runs on port 3001 (configurable)

**Example**:
```typescript
describe('Document Ingestion E2E', () => {
  it('should ingest a Markdown document', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/documents/upload')
      .attach('file', markdownContent);
    expect(response.status).toBe(201);
  });
});
```

---

## 📦 **Prerequisites**

### **For Unit Tests**
- Node.js ≥ 18
- pnpm ≥ 8

### **For Integration & E2E Tests**
- PostgreSQL 16 with `pgvector` extension
- Docker & Docker Compose (recommended)

### **Environment Setup**

1. **Start the test database**:
```bash
docker compose up -d
```

2. **Run migrations**:
```bash
pnpm run migration:run
```

3. **Set environment variables** (see `.env.test.example`):
```bash
cp .env.example .env.test
# Edit .env.test with your test database credentials
```

---

## 🚀 **Running Tests**

### **Run All Unit Tests**
```bash
pnpm run test
```

### **Run Unit Tests in Watch Mode**
```bash
pnpm run test:watch
```

### **Run Unit Tests with Coverage**
```bash
pnpm run test:cov
```

### **Run Integration Tests**
```bash
pnpm run test:integration
```
**Note**: Requires PostgreSQL to be running.

### **Run E2E Tests**
```bash
pnpm run test:e2e
```
**Note**: Requires PostgreSQL to be running.

### **Run All Tests (Unit + Integration + E2E)**
```bash
pnpm run test:all
```

### **Run Specific Test File**
```bash
# Unit test
pnpm run test -- knowledge-source.entity.spec.ts

# Integration test
pnpm run test:integration -- knowledge-repository.integration.spec.ts

# E2E test
pnpm run test:e2e -- document-ingestion.e2e-spec.ts
```

### **Debug Tests**
```bash
pnpm run test:debug
```
Then attach your debugger to the Node process.

---

## 📂 **Test Structure**

```
test/
├── unit/                           # Unit tests
│   └── modules/
│       └── knowledge/
│           ├── domain/
│           │   ├── entities/       # Entity tests
│           │   └── repositories/   # Repository interface tests
│           ├── application/
│           │   └── use-cases/      # Use case tests
│           ├── infrastructure/
│           │   ├── services/       # Service tests
│           │   └── persistence/    # Persistence tests
│           └── presentation/
│               └── controllers/    # Controller tests
├── integration/                    # Integration tests
│   ├── modules/
│   │   └── knowledge/
│   │       └── knowledge-repository.integration.spec.ts
│   ├── test-db.config.ts          # Test DB configuration
│   ├── test-helpers.ts            # Test utilities
│   └── jest-setup.ts              # Integration test setup
├── e2e/                           # End-to-end tests
│   ├── document-ingestion.e2e-spec.ts
│   └── jest-setup.ts              # E2E test setup
├── fixtures/                      # Test data
│   ├── test-document.md           # Sample Markdown
│   └── create-test-pdf.ts         # PDF generator
├── jest-integration.json          # Integration test config
├── jest-e2e.json                  # E2E test config
└── README.md                      # This file
```

---

## ✍️ **Writing New Tests**

### **Best Practices**

1. **Follow AAA Pattern**:
```typescript
it('should do something', () => {
  // Arrange - Set up test data
  const input = createTestData();
  
  // Act - Execute the action
  const result = service.doSomething(input);
  
  // Assert - Verify the result
  expect(result).toBe(expected);
});
```

2. **Use Descriptive Test Names**:
```typescript
// ❌ Bad
it('should work', () => { ... });

// ✅ Good
it('should throw error when title exceeds 255 characters', () => { ... });
```

3. **One Assertion Per Test** (when possible):
```typescript
// ❌ Bad - Multiple unrelated assertions
it('should create entity', () => {
  expect(entity.title).toBe('Test');
  expect(entity.status).toBe(SourceStatus.PENDING);
  expect(entity.isStale()).toBe(false);
});

// ✅ Good - Split into focused tests
it('should create entity with given title', () => {
  expect(entity.title).toBe('Test');
});

it('should create entity with PENDING status', () => {
  expect(entity.status).toBe(SourceStatus.PENDING);
});
```

4. **Clean Up After Tests**:
```typescript
afterEach(async () => {
  await cleanupDatabase(dataSource);
  jest.clearAllMocks();
});
```

5. **Mock External Dependencies**:
```typescript
// Always mock Genkit/Gemini API calls
jest.mock('genkit', () => ({
  genkit: jest.fn(() => mockGenkit),
}));
```

### **Naming Conventions**

- **Unit tests**: `*.spec.ts`
- **Integration tests**: `*.integration.spec.ts`
- **E2E tests**: `*.e2e-spec.ts`

### **Test Data Helpers**

Use helpers from `test-helpers.ts`:
```typescript
import { createTestUuid, createTestDate } from '../test-helpers';

const sectorId = createTestUuid('sector-');
const date = createTestDate(7); // 7 days ago
```

---

## 🐛 **Troubleshooting**

### **Database Connection Issues**

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Check if PostgreSQL is running
docker compose ps

# Start PostgreSQL
docker compose up -d

# Check logs
docker compose logs db
```

### **pgvector Extension Not Found**

**Problem**: `extension "vector" does not exist`

**Solution**:
```bash
# Connect to database
docker compose exec db psql -U context_ai_user -d context_ai_test

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### **Migration Issues**

**Problem**: `relation "knowledge_sources" does not exist`

**Solution**:
```bash
# Run migrations
pnpm run migration:run

# Or for test database, set synchronize: true in test-db.config.ts
```

### **Test Timeouts**

**Problem**: `Timeout - Async callback was not invoked within the 5000 ms timeout`

**Solution**:
- Increase timeout in Jest config or test file:
```typescript
jest.setTimeout(30000); // 30 seconds
```

### **Mock Issues**

**Problem**: `Cannot find module 'pdfjs-dist'` or `import.meta` errors

**Solution**:
- Ensure mocks are at the top of test files:
```typescript
jest.mock('pdfjs-dist', () => ({ ... }));
```

### **Clean Test Database**

If tests are polluted:
```bash
# Drop and recreate test database
docker compose down -v
docker compose up -d
pnpm run migration:run
```

---

## 📊 **Coverage Reports**

After running `pnpm run test:cov`, view the coverage report:

```bash
# Open in browser
open coverage/index.html

# Or view in terminal
cat coverage/lcov-report/index.html
```

**Coverage Thresholds**:
- Branches: ≥75%
- Functions: ≥80%
- Lines: ≥80%
- Statements: ≥80%

---

## 🔗 **Related Documentation**

- [Database Setup](../docs/DATABASE_SETUP.md)
- [Environment Variables](../docs/ENVIRONMENT_VARIABLES.md)
- [Security Guidelines](../docs/SECURITY.md)
- [Branching Strategy](../docs/BRANCHING_STRATEGY.md)

---

## 📝 **Notes**

- Integration and E2E tests run **sequentially** (`--runInBand`) to avoid database conflicts
- Tests use a separate `context_ai_test` database to avoid polluting development data
- External API calls (Genkit/Gemini) are always mocked to ensure test reliability
- Test fixtures are version-controlled for consistency

---

**Happy Testing! 🎉**


