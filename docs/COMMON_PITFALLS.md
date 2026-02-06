# Common Pitfalls & Solutions

This document lists common mistakes and how to avoid them when working on Context.AI API.

---

## 📚 PDF Parsing Library

### ❌ Problem: Using Wrong PDF Library

**CRITICAL**: Always use `pdf-parse`

**Why?**
- Official Genkit documentation uses `pdf-parse`
- Has official type definitions: `@types/pdf-parse`
- Works correctly in Node.js and CI/CD environments

**Installation**:
```bash
pnpm add pdf-parse
pnpm add -D @types/pdf-parse
```

**Usage**:
```typescript
import pdf from 'pdf-parse';

async function parsePdf(buffer: Buffer) {
  const pdfParse = pdf as unknown as (
    buffer: Buffer,
  ) => Promise<PdfParseResult>;
  const data = await pdfParse(buffer);
  return data.text;
}
```

**Don't use**:
- ❌ `pdf-parse-fork` (compatibility issues)
- ❌ `pdfjs-dist` (browser-only, fails in Node.js)

---

## 🔗 External Package Dependencies

### ❌ Problem: CI/CD Failing on External Packages

**Issue**: CI/CD may fail if external packages (`@context-ai/shared`) are not properly resolved.

**Solution**: Copy essential types locally

```typescript
// src/shared/types/enums/source-type.enum.ts
export enum SourceType {
  PDF = 'PDF',
  MARKDOWN = 'MARKDOWN',
  URL = 'URL',
}

// src/shared/types/enums/source-status.enum.ts
export enum SourceStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

// src/shared/types/index.ts
export * from './enums';
```

**Update imports**:
```typescript
// ✅ GOOD - Local import
import { SourceType, SourceStatus } from '@shared/types';

// ❌ BAD - External package (might fail in CI)
import { SourceType } from '@context-ai/shared';
```

---

## 🗄️ TypeORM Indexes

### ❌ Problem: Duplicate Index Decorators

**Error**: `QueryFailedError: relation "IDX_xxx" already exists`

**Cause**: Duplicate `@Index()` decorators on the same column

```typescript
// ❌ BAD - Duplicate indexes
@Entity('knowledge_sources')
@Index(['sectorId', 'createdAt']) // Composite index
export class KnowledgeSourceModel {
  @Column()
  @Index() // ❌ Duplicate! Already in composite index
  sectorId: string;

  @Column()
  @Index() // ❌ Duplicate!
  createdAt: Date;
}

// ✅ GOOD - Single index definition
@Entity('knowledge_sources')
@Index(['sectorId', 'createdAt']) // Composite index
export class KnowledgeSourceModel {
  @Column()
  sectorId: string;

  @Column()
  createdAt: Date;
}

// ✅ ALSO GOOD - If you need separate indexes
@Entity('knowledge_sources')
export class KnowledgeSourceModel {
  @Column()
  @Index() // Individual index
  sectorId: string;

  @Column()
  @Index() // Individual index
  createdAt: Date;
}
```

**Fix**:
1. Drop the database
2. Remove duplicate indexes
3. Run migrations fresh

```bash
pnpm migration:revert
pnpm migration:run
```

---

## 🔒 Double Escaping Vulnerability

### ❌ Problem: CodeQL Alert - "Double escaping or unescaping"

**Issue**: Decoding HTML entities before removing HTML tags can lead to XSS vulnerabilities

```typescript
// ❌ BAD - Double unescaping vulnerability
private stripHtmlTags(text: string): string {
  const decoded = he.decode(text); // First decode
  return decoded.replace(/<[^>]*>/g, ''); // HTML entities decoded again!
}

// ✅ GOOD - Single decode after stripping
private stripHtmlTags(text: string): string {
  const stripped = text.replace(/<[^>]*>/g, '');
  return he.decode(stripped);
}
```

**Why?** 
If you decode first, then strip tags, specially crafted input like `&lt;script&gt;` becomes `<script>` after decode, but the tag stripping already happened, so the malicious script remains.

---

## 🧪 Test Mocking

### ❌ Problem: Mock Not Working

**Common causes**:

1. **Wrong mock location**
   ```typescript
   // ❌ BAD - Mock after import
   import { someFunction } from 'module';
   jest.mock('module');

   // ✅ GOOD - Mock before imports
   jest.mock('module');
   import { someFunction } from 'module';
   ```

2. **Incorrect module path**
   ```typescript
   // ❌ BAD - Wrong path
   jest.mock('pdf-parse-fork');
   import pdf from 'pdf-parse'; // Different module!

   // ✅ GOOD - Correct path
   jest.mock('pdf-parse');
   import pdf from 'pdf-parse';
   ```

3. **Not mocking default export**
   ```typescript
   // ❌ BAD - Missing default export
   jest.mock('pdf-parse', () => ({
     parse: jest.fn(),
   }));

   // ✅ GOOD - Mock default export
   jest.mock('pdf-parse', () => ({
     __esModule: true,
     default: jest.fn().mockImplementation((buffer: Buffer) => {
       return Promise.resolve({
         text: 'Mocked content',
         numpages: 1,
       });
     }),
   }));
   ```

---

## 🎯 TypeScript Strict Mode Errors

### ❌ Problem: `any` Type Errors

**Error**: `Unsafe assignment of an error typed value`

```typescript
// ❌ BAD - Implicit any
const data = await someFunction();
const value = data.field;

// ✅ GOOD - Explicit types
interface DataType {
  field: string;
}
const data: DataType = await someFunction();
const value: string = data.field;
```

**Error**: `Unsafe member access`

```typescript
// ❌ BAD - No type assertion
const info = data.info;
const title = info.Title;

// ✅ GOOD - Type assertion
const info: Record<string, unknown> = data.info;
const title = typeof info.Title === 'string' ? info.Title : '';
```

---

## 🔄 Migration Issues

### ❌ Problem: Migration Conflicts

**Symptoms**:
- Migration fails with "relation already exists"
- Schema out of sync with migrations

**Solutions**:

1. **For Development**:
   ```bash
   # Drop and recreate
   pnpm migration:revert
   pnpm migration:drop
   pnpm migration:generate src/migrations/NewMigration
   pnpm migration:run
   ```

2. **For Production**:
   ```bash
   # Create new migration to fix
   pnpm migration:generate src/migrations/FixConflict
   # Edit migration to handle existing state
   pnpm migration:run
   ```

**Prevention**:
- Always generate migrations for schema changes
- Never modify database manually
- Test migrations in dev environment first

---

## 🌐 Environment Variables

### ❌ Problem: Missing Environment Variables

**Symptoms**:
- App crashes on startup
- "undefined" values in config

**Solution**: Validate on startup

```typescript
// config/env.validation.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.string().regex(/^\d+$/),
  DATABASE_USER: z.string(),
  DATABASE_PASSWORD: z.string(),
  GENKIT_API_KEY: z.string().min(1),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
}
```

**Call in `main.ts`**:
```typescript
async function bootstrap() {
  validateEnv(); // Fail fast on startup
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
```

---

## 🧹 Linting & Formatting

### ❌ Problem: CI/CD Fails on Formatting

**Symptoms**:
- Local tests pass, CI/CD fails
- "Code formatting issues" error

**Solution**: Run before commit

```bash
# Format code
pnpm format

# Check formatting without fixing
pnpm format:check

# Lint and fix
pnpm lint
```

**Prevention**: Use pre-commit hooks (already configured)

```bash
# Husky hooks automatically run:
# - pre-commit: pnpm lint
# - pre-push: pnpm lint && pnpm build
```

---

## 🔍 Debugging Tips

### Problem: Test Passing Locally, Failing in CI

**Common causes**:

1. **Environment differences**
   - Check Node.js version
   - Check pnpm version
   - Check environment variables

2. **Timing issues**
   - Add proper awaits
   - Increase timeouts for slow operations

3. **Database state**
   - Ensure clean state between tests
   - Check transaction isolation

**Solution**:
```typescript
// ✅ GOOD - Proper cleanup
afterEach(async () => {
  await clearDatabase(dataSource);
});

// ✅ GOOD - Increase timeout for slow tests
it('should process large document', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

---

## 📋 Quick Debugging Checklist

When something breaks:

1. ✅ Run `pnpm lint` - Fix any warnings
2. ✅ Run `pnpm build` - Check TypeScript errors
3. ✅ Run `pnpm test` - Verify all tests pass
4. ✅ Check environment variables
5. ✅ Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
6. ✅ Check git status for uncommitted changes
7. ✅ Review recent changes: `git diff`
8. ✅ Check CI/CD logs for specific errors

---

## 📚 When to Ask for Help

Ask when:
- Same error persists after trying documented solutions
- CI/CD passes but local fails (or vice versa)
- Security alert you don't understand
- Architecture decision needed

Don't ask when:
- Linting errors (run `pnpm lint`)
- Formatting errors (run `pnpm format`)
- Simple TypeScript errors (read the error message)
- Missing dependencies (run `pnpm install`)

---

## 🔗 Related Documentation

- [Testing Guidelines](./TESTING_GUIDELINES.md)
- [Security Guidelines](./SECURITY_GUIDELINES.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Setup](./DATABASE_SETUP.md)

