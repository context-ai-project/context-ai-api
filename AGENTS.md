# AI Agent Guidelines for Context.AI API

This document provides essential guidelines and collaboration rules for AI agents working on the Context.AI API project.

---

## 📋 Quick Reference

| Topic | Document |
|-------|----------|
| **Architecture** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Testing** | [docs/TESTING_GUIDELINES.md](docs/TESTING_GUIDELINES.md) |
| **Security** | [docs/SECURITY_GUIDELINES.md](docs/SECURITY_GUIDELINES.md) |
| **Database Setup** | [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) |
| **Environment Variables** | [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) |
| **Auth0 Setup** | [docs/AUTH0_SETUP.md](docs/AUTH0_SETUP.md) |
| **CI/CD** | [docs/CI_CD.md](docs/CI_CD.md) |
| **Rate Limiting** | [docs/RATE_LIMITING.md](docs/RATE_LIMITING.md) |
| **Branching Strategy** | [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md) |

---

## 🎯 Project Overview

**Context.AI API** is a RAG-based knowledge management system built with:
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + Pinecone (vector search)
- **AI Framework**: Google Genkit
- **Architecture**: Clean Architecture / DDD

### Project Structure

```
context-ai-api/
├── src/
│   ├── modules/
│   │   ├── audit/         # Audit logging (13 event types)
│   │   ├── auth/          # Authentication, RBAC, guards, decorators
│   │   ├── interaction/   # Chat/RAG conversation management
│   │   ├── knowledge/     # Document ingestion, chunking, embeddings
│   │   └── users/         # User management and sync
│   ├── shared/            # Prompts, validators, utils, constants, genkit
│   ├── config/            # App, auth, database, throttle configs
│   └── migrations/        # TypeORM migrations
├── test/
│   ├── unit/              # Unit tests (mirrors src/ structure)
│   ├── integration/       # Integration tests (DB, Pinecone, modules)
│   ├── e2e/               # End-to-end tests (API flows)
│   ├── contract/          # API contract tests
│   ├── security/          # Security-specific tests
│   ├── performance/       # Response time tests
│   └── smoke/             # Smoke & MVP validation tests
└── docs/                  # 📚 Detailed documentation
```

---

## 🔄 Development Workflow

### 1. Test-Driven Development (TDD)

**MANDATORY**: Follow Red-Green-Refactor cycle

1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve while keeping tests green

```bash
pnpm test:watch  # Start TDD workflow
```

### 2. Git Workflow

```bash
# Create feature branch from develop
git checkout -b feature/your-feature-name

# Commit with conventional format
git commit -m "feat: add new feature"

# Push and create PR to develop
git push origin feature/your-feature-name
```

**Commit Conventions**:
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `test:` Test changes
- `docs:` Documentation
- `chore:` Build/config

### 3. Branch Strategy

- `main` → Production
- `develop` → Integration
- `feature/*` → New features
- `bugfix/*` → Bug fixes
- `hotfix/*` → Urgent fixes

---

## ✅ Code Quality Standards

### Critical Rules

1. ❌ **NEVER use `any` type**
   ```typescript
   // ❌ BAD
   const data: any = await someFunction();
   
   // ✅ GOOD
   interface ExpectedData { field: string; }
   const data: ExpectedData = await someFunction();
   ```

2. ❌ **NEVER disable ESLint without justification**
   ```typescript
   // ❌ BAD
   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
   
   // ✅ GOOD - with reason
   // eslint-disable-next-line security/detect-object-injection -- Safe: key from predefined array
   ```

3. ✅ **Always explicit types**
   ```typescript
   async function fetchData(): Promise<DataType> {
     const data: DataType = await repository.find();
     return data;
   }
   ```

### Error Handling

```typescript
// ✅ GOOD - Type-safe error handling
try {
  const result = await operation();
} catch (error) {
  throw new Error(
    `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}
```

---

## ✅ Validation Checklist

**MANDATORY before every commit**:

```bash
# 1. Lint (auto-fix)
pnpm lint

# 2. Type check
pnpm build

# 3. Tests
pnpm test

# One-liner
pnpm lint && pnpm build && pnpm test
```

### Pre-commit Hooks

Husky automatically runs:
- **pre-commit**: `npx lint-staged` (runs eslint --fix + prettier on staged `src/**/*.ts` files)
- **pre-push**: `pnpm test && pnpm lint`

### CI/CD Pipeline

GitHub Actions workflows are defined in [docs/CI_CD.md](docs/CI_CD.md) and validate:
1. Linting (ESLint + Prettier)
2. Build (TypeScript)
3. Tests (Unit + Integration + E2E)
4. Security (CodeQL + eslint-plugin-security)

**All checks must pass before merging to `develop`**

---

## 🎯 Best Practices Summary

### DO ✅

1. **Follow TDD** - Write tests first
2. **Use explicit types** - Never `any`
3. **Validate inputs** - Use DTOs
4. **Handle errors** - Type guards
5. **Run validation** - Before commit
6. **Use official libs** - Follow Genkit
7. **Respect layers** - Clean Architecture
8. **Meaningful commits** - Conventional format

### DON'T ❌

1. **Don't disable ESLint** - Without reason
2. **Don't use `any`** - Ever
3. **Don't skip validation** - Lint + Build + Test
4. **Don't skip tests** - Meet coverage thresholds (functions: 85%, lines/branches/statements: 80%)
5. **Don't log secrets** - Use env vars
6. **Don't bypass DTOs** - Always validate
7. **Don't mix layers** - Follow architecture
8. **Don't ignore CI/CD** - Fix before merge

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | NestJS |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Pinecone |
| AI | Google Genkit |
| LLM | Gemini 2.5 Flash |
| Embeddings | gemini-embedding-001 (3072 dimensions) |
| Vector DB | Pinecone |
| ORM | TypeORM |
| Validation | class-validator |
| Testing | Jest |
| Package Manager | pnpm |

### Coverage Thresholds

Configured in `package.json` → `jest.coverageThreshold`:

| Metric | Threshold |
|--------|-----------|
| Functions | 85% |
| Lines | 80% |
| Branches | 80% |
| Statements | 80% |

```bash
pnpm test:cov  # Run tests with coverage report
```

### PDF Processing

```bash
# ✅ OFFICIAL - Use this
pnpm add pdf-parse
pnpm add -D @types/pdf-parse
```

**Why?** Official Genkit recommendation with proper types.

---

## 🤖 AI Agent Collaboration Rules

### Before Making Changes

1. **Read this file** (AGENTS.md) first
2. **Check detailed docs** in `docs/` if needed:
   - Architecture questions → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
   - Testing questions → [docs/TESTING_GUIDELINES.md](docs/TESTING_GUIDELINES.md)
   - Security questions → [docs/SECURITY_GUIDELINES.md](docs/SECURITY_GUIDELINES.md)
3. **Review conversation history** - Understand context
4. **Check open files** - What user is working on
5. **Read existing code** - Before suggesting changes

### Communication Style

1. **Be concise** but thorough
2. **Show examples** for complex concepts
3. **Explain trade-offs** when multiple solutions exist
4. **Ask for clarification** when unclear
5. **Provide validation steps** after changes

### Code Changes Process

1. **Follow TDD**
   ```bash
   # Write failing test
   pnpm test:watch
   
   # Implement feature
   # Make test pass
   
   # Validate
   pnpm lint && pnpm build && pnpm test
   ```

2. **Make atomic changes** - One logical change per commit

3. **Validate immediately** - Don't skip checks

4. **Document rationale** - Explain why, not just what

5. **Consider security** - Apply OWASP guidelines (see [docs/SECURITY_GUIDELINES.md](docs/SECURITY_GUIDELINES.md))

### Problem Solving

1. **Understand root cause** - Don't just fix symptoms
2. **Check for patterns** - Similar code in codebase
3. **Consider side effects** - What else might break
4. **Test edge cases** - Thoroughly
5. **Document lessons** - Update this file or docs

### When to Read Detailed Docs

- **Architecture questions?** → Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How to write tests?** → Read [docs/TESTING_GUIDELINES.md](docs/TESTING_GUIDELINES.md)
- **Security concerns?** → Read [docs/SECURITY_GUIDELINES.md](docs/SECURITY_GUIDELINES.md)
- **Database setup?** → Read [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)
- **Environment config?** → Read [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)
- **Auth0 config?** → Read [docs/AUTH0_SETUP.md](docs/AUTH0_SETUP.md)
- **Rate limiting?** → Read [docs/RATE_LIMITING.md](docs/RATE_LIMITING.md)
- **Git branching?** → Read [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md)
- **CI/CD pipelines?** → Read [docs/CI_CD.md](docs/CI_CD.md)

---

## 🐛 Code Smells to Avoid

### 🏗 Structural

| Smell | Description | How to Avoid |
|-------|-------------|--------------|
| **Long Method** | Functions/methods exceeding ~50 lines | Extract into smaller private methods or dedicated use cases |
| **Large Class** | Classes with too many responsibilities | Split by single responsibility following Clean Architecture layers |
| **Long Parameter List** | Methods with 4+ parameters | Group into a DTO or options object |
| **Data Clumps** | Groups of values that always appear together | Create a dedicated DTO, value object, or entity |

### 🔄 Behavioral

| Smell | Description | How to Avoid |
|-------|-------------|--------------|
| **Duplicate Code** | Repeated logic across services or controllers | Extract into shared utils, base classes, or dedicated services |
| **Switch Statements** | Long `switch`/`if-else` chains for type-based logic | Use strategy pattern, maps, or polymorphism |
| **Lazy Class** | A class/service that does almost nothing | Inline it or merge it with a related module |
| **Dead Code** | Unused imports, variables, methods, or classes | Remove immediately; rely on ESLint `no-unused-vars` |

### 🎯 Object-Oriented

| Smell | Description | How to Avoid |
|-------|-------------|--------------|
| **Feature Envy** | A service accessing another module's internals excessively | Move the logic to where the data lives; use proper interfaces |
| **Inappropriate Intimacy** | Modules tightly coupled to internal details of others | Depend on interfaces, not implementations (DIP) |
| **Refused Bequest** | Extending a class but ignoring most of its behavior | Prefer composition over inheritance |
| **Middle Man** | A class that only delegates to another without adding value | Remove the wrapper; inject the dependency directly |

### 💾 Data

| Smell | Description | How to Avoid |
|-------|-------------|--------------|
| **Primitive Obsession** | Using raw `string`/`number` instead of domain types | Create enums, branded types, or value objects (e.g. `SectorStatus`) |
| **Data Class** | Classes with only data and no behavior | Add domain methods to entities or use alongside use cases |
| **Temporary Field** | Properties only used in specific conditions | Extract into a sub-entity or conditional DTO |
| **Magic Numbers** | Hard-coded numeric/string literals | Extract into named constants (e.g. `RECENT_USERS_DAYS_THRESHOLD`) |

---

## 🚀 Quick Start for New Features

```bash
# 1. Create branch
git checkout -b feature/my-feature

# 2. Write failing test
pnpm test:watch

# 3. Implement feature (following Clean Architecture)

# 4. Validate
pnpm lint && pnpm build && pnpm test

# 5. Commit
git add .
git commit -m "feat: add new feature"

# 6. Push and create PR
git push origin feature/my-feature
```

---

## 📞 Additional Resources

- **Genkit Docs**: https://genkit.dev/docs
- **NestJS Docs**: https://docs.nestjs.com
- **TypeORM Docs**: https://typeorm.io
- **OWASP Top 10**: https://owasp.org/www-project-top-ten
- **Swagger UI**: http://localhost:3001/api/docs (when running locally)

---

**Note**: This is a living document. Update it as new patterns emerge.
