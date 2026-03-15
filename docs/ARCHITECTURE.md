# Architecture Guidelines

This document describes the architecture principles, patterns, and system design of Context.AI API.

---

## 📋 Table of Contents

- [Architecture Guidelines](#architecture-guidelines)
  - [📋 Table of Contents](#-table-of-contents)
  - [🛠️ Technology Stack](#️-technology-stack)
  - [🏗️ Clean Architecture Layers](#️-clean-architecture-layers)
    - [Layer Structure](#layer-structure)
    - [Dependency Rule](#dependency-rule)
  - [📦 System Modules](#-system-modules)
    - [Module Overview](#module-overview)
    - [Module Dependencies (AppModule)](#module-dependencies-appmodule)
  - [🤖 RAG Architecture](#-rag-architecture)
    - [Document Ingestion Pipeline](#document-ingestion-pipeline)
    - [RAG Query Flow](#rag-query-flow)
    - [RAG Evaluation (LLM-as-Judge)](#rag-evaluation-llm-as-judge)
    - [Conversation Context](#conversation-context)
    - [AI Configuration](#ai-configuration)
    - [Prompt Engineering](#prompt-engineering)
  - [🗄️ Data Storage Architecture](#️-data-storage-architecture)
    - [Responsibilities](#responsibilities)
    - [Multi-Tenancy](#multi-tenancy)
    - [Key Interface: `IVectorStore`](#key-interface-ivectorstore)
  - [🔐 Security Architecture](#-security-architecture)
    - [RBAC Model](#rbac-model)
    - [Decorators](#decorators)
  - [🔧 Shared Module](#-shared-module)
    - [Genkit Configuration (`GENKIT_CONFIG`)](#genkit-configuration-genkit_config)
  - [🎨 Key Design Patterns](#-key-design-patterns)
    - [Repository Pattern](#repository-pattern)
    - [Dependency Injection](#dependency-injection)
    - [DTO Pattern](#dto-pattern)
    - [Mapper Pattern](#mapper-pattern)
    - [Guard Pipeline Pattern](#guard-pipeline-pattern)
  - [📁 Module Structure](#-module-structure)
  - [🔄 Data Flow](#-data-flow)
    - [Document Ingestion Flow](#document-ingestion-flow)
    - [RAG Query Flow](#rag-query-flow-1)
  - [✅ Architecture Principles](#-architecture-principles)
  - [🚫 What NOT to Do](#-what-not-to-do)
  - [📚 Related Documentation](#-related-documentation)
  - [📖 References](#-references)

---

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | NestJS 11 | Backend framework with DI and modularity |
| **Language** | TypeScript (strict mode) | Type safety and developer experience |
| **Database** | PostgreSQL 16 | Relational data (users, sources, fragments, conversations) |
| **Vector DB** | Pinecone | Vector similarity search for RAG |
| **AI Framework** | Google Genkit + Vertex AI | LLM orchestration and embeddings (ADC auth, no API key) |
| **LLM Model** | Gemini 2.5 Flash (Vertex AI) | Chat and RAG response generation |
| **Embedding Model** | gemini-embedding-001 (Vertex AI, 3072 dim) | Document and query vectorization |
| **ORM** | TypeORM | Database access and migrations |
| **Auth** | Auth0 (OAuth2 + JWT RS256) | Identity provider and authentication |
| **Authorization** | Custom RBAC | Role-based access control (3 roles, 10 permissions) |
| **Validation** | class-validator | DTO input validation |
| **API Docs** | Swagger / OpenAPI | Interactive API documentation |
| **Testing** | Jest | Unit, integration, and E2E tests |
| **Package Manager** | pnpm | Fast, disk-efficient dependency management |

---

## 🏗️ Clean Architecture Layers

The project follows **Clean Architecture** with 4 layers and strict dependency direction (outer → inner):

### Layer Structure

1. **Domain Layer** (`domain/`)
   - Pure business logic
   - No external dependencies
   - Entities with self-validation
   - Repository interfaces (abstractions)
   - Value Objects
   - Service interfaces (e.g., `IVectorStore`)

2. **Application Layer** (`application/`)
   - Use cases (orchestration)
   - DTOs (Data Transfer Objects)
   - Business rules coordination
   - Application services

3. **Infrastructure Layer** (`infrastructure/`)
   - External services (Genkit, Pinecone, PDF parsing)
   - Database persistence (TypeORM models, mappers)
   - Repository implementations
   - Third-party integrations

4. **Presentation Layer** (`presentation/`)
   - REST API controllers
   - Request/response handling
   - Swagger documentation
   - DTO mappers (domain → response)

### Dependency Rule

```
Presentation → Application → Domain ← Infrastructure
                                ↑          |
                                └──────────┘
                          (implements interfaces)
```

---

## 📦 System Modules

The application is organized as a **modular monolith** with 5 feature modules:

```
src/modules/
├── knowledge/       # Knowledge base management (documents, fragments)
├── interaction/     # Chat and RAG query system
├── auth/            # Authentication (Auth0 JWT) and Authorization (RBAC)
├── users/           # User management and Auth0 sync
└── audit/           # Security audit logging
```

### Module Overview

| Module | Responsibility | Key Components |
|--------|---------------|----------------|
| **knowledge** | Document ingestion, chunking, embedding, vector storage | `IngestDocumentUseCase`, `DeleteSourceUseCase`, `ChunkingService`, `EmbeddingService`, `PineconeVectorStoreService` |
| **interaction** | Chat interface, conversation management, RAG queries, response evaluation | `QueryAssistantUseCase`, `Conversation`, `Message`, `RagQueryFlow`, `RagEvaluatorService` |
| **auth** | JWT validation, RBAC, token revocation, role/permission management | `JwtAuthGuard`, `RBACGuard`, `PermissionService`, `TokenRevocationService`, `RbacSeederService` |
| **users** | User CRUD, Auth0 user sync on first login | `UserService`, `UserController` |
| **audit** | Security event logging, compliance tracking | `AuditService`, `AuditLog` (13 event types) |

### Module Dependencies (AppModule)

```typescript
@Module({
  imports: [
    ConfigModule,        // Global configuration
    TypeOrmModule,       // Database connection
    ThrottlerModule,     // Rate limiting
    KnowledgeModule,     // Knowledge base
    InteractionModule,   // Chat & RAG
    UsersModule,         // User management
    AuthModule,          // Auth0 + RBAC
    AuditModule,         // Audit logging
  ],
  providers: [
    ThrottlerGuard,      // Global rate limiting
    JwtAuthGuard,        // Global JWT authentication
    RBACGuard,           // Global RBAC authorization
  ],
})
```

---

## 🤖 RAG Architecture

Context.AI implements a **Retrieval-Augmented Generation (RAG)** pattern. This is the core of the system.

### Document Ingestion Pipeline

```
PDF/Markdown Upload → DocumentParserService → ChunkingService → EmbeddingService → Dual Store
                           │                       │                    │               │
                      Extract text           Split into            Generate         PostgreSQL (text)
                      + metadata             fragments            embeddings       Pinecone (vectors)
```

**Step by step**:
1. **Parse**: `DocumentParserService` extracts text from PDF (`pdf-parse`) or Markdown
2. **Chunk**: `ChunkingService` splits text into semantic fragments
3. **Embed**: `EmbeddingService` generates 3072-dimensional vectors via Genkit (`gemini-embedding-001`)
4. **Store**: Fragments saved to PostgreSQL, embeddings upserted to Pinecone (namespaced by `sectorId`)

### RAG Query Flow

```
User Query → Embedding → Vector Search → Context Building → LLM Generation → Evaluation → Response
     │            │             │                │                  │              │            │
  Validate   gemini-        Pinecone         Build prompt     Gemini 2.5    LLM-as-judge  Return with
  input     embedding-001   similarity       with fragments     Flash      (Faithfulness  sources +
                            search                                         + Relevancy)   eval scores
```

**Step by step** (implemented in `rag-query.flow.ts`):
1. **Embed query**: Generate embedding for the user's question
2. **Vector search**: Find similar fragments in Pinecone (filtered by `sectorId` namespace)
3. **Filter**: Apply minimum similarity threshold (default: 0.7)
4. **Build prompt**: Combine system prompt + documentation context + user question
5. **Generate**: Call Gemini 2.5 Flash with RAG-optimized config (temperature: 0.3)
6. **Evaluate**: Run `RagEvaluatorService` (LLM-as-judge) to score Faithfulness + Relevancy in parallel
7. **Return**: Structured response with cited source fragments, metadata, and evaluation scores

### RAG Evaluation (LLM-as-Judge)

The `RagEvaluatorService` evaluates every RAG response on two dimensions:

| Evaluator | What It Measures | Pass Threshold |
|-----------|-----------------|----------------|
| **Faithfulness** | Is the response grounded in the retrieved context? | ≥ 0.6 |
| **Relevancy** | Does the response address the user's question? | ≥ 0.6 |

**Architecture**:
- Uses the same Gemini 2.5 Flash model (temperature: 0.1 for evaluation consistency)
- Both evaluations run **in parallel** (`Promise.all`) for performance
- Response validated with **Zod schema** (`evaluationScoreSchema`): `score` (0-1), `status` (PASS/FAIL/UNKNOWN), `reasoning`
- **Graceful degradation**: If evaluation fails, returns `status: UNKNOWN` without blocking the main RAG response
- Scores stored in `message.metadata.evaluation` and exposed in `QueryAssistantResponseDto.evaluation`

```typescript
// evaluation.types.ts
export interface EvaluationScore {
  score: number;       // 0.0 - 1.0
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reasoning: string;   // Brief explanation from the LLM judge
}

export interface RagEvaluationResult {
  faithfulness: EvaluationScore;
  relevancy: EvaluationScore;
}
```

### Conversation Context

The `QueryAssistantUseCase` orchestrates the full interaction:

```
User Question → Get/Create Conversation → Build Contextual Query → RAG Flow → Save Messages → Response
                        │                        │                     │              │
                  Conversation           Add conversation         Execute RAG    Persist user +
                  Repository             history to query         pipeline       assistant messages
```

### AI Configuration

| Parameter | Default | RAG Config |
|-----------|---------|------------|
| **Temperature** | 0.7 | 0.3 (conservative/factual) |
| **Max Output Tokens** | 2048 | 1024 |
| **Top K** | 40 | 20 |
| **Top P** | 0.95 | 0.9 |

### Prompt Engineering

The `PromptService` provides specialized prompt templates:

| Prompt Type | Use Case |
|-------------|----------|
| `ONBOARDING` | Help new employees understand policies |
| `POLICY` | Explain company regulations |
| `PROCEDURE` | Step-by-step process guidance |
| `GENERAL` | General company questions |

All prompts enforce grounded responses: the LLM only answers from provided documentation context.

---

## 🗄️ Data Storage Architecture

Context.AI uses a **dual-store architecture**:

```
┌─────────────────────────────────┐     ┌────────────────────────────────┐
│         PostgreSQL 16            │     │          Pinecone              │
│  ┌─────────────────────────────┐│     │  ┌──────────────────────────┐ │
│  │ knowledge_sources           ││     │  │ Vectors (3072 dim)       │ │
│  │ fragments (text only)       ││     │  │ Namespaced by sectorId   │ │
│  │ conversations               ││     │  │ Metadata: sourceId,      │ │
│  │ messages                    ││     │  │   content, position,     │ │
│  │ users                       ││     │  │   tokenCount             │ │
│  │ roles / permissions         ││     │  └──────────────────────────┘ │
│  │ audit_logs                  ││     │                                │
│  └─────────────────────────────┘│     │  metric: cosine               │
│                                  │     │  type: serverless             │
└─────────────────────────────────┘     └────────────────────────────────┘
```

### Responsibilities

| Store | Data | Purpose |
|-------|------|---------|
| **PostgreSQL** | Relational data (sources, fragments text, users, conversations, RBAC, audit) | Source of truth for all structured data |
| **Pinecone** | Vector embeddings (3072 dimensions, gemini-embedding-001) | Similarity search for RAG retrieval |

### Multi-Tenancy

Data isolation is achieved via `sectorId`:
- **PostgreSQL**: Filtered by `sector_id` column in queries
- **Pinecone**: Each sector maps to a separate **namespace**, providing hard isolation of vector data

### Key Interface: `IVectorStore`

The vector store is abstracted behind a domain interface, enabling provider swaps:

```typescript
export interface IVectorStore {
  upsertVectors(inputs: VectorUpsertInput[]): Promise<void>;
  vectorSearch(embedding: number[], sectorId: string, limit?: number, minScore?: number): Promise<VectorSearchResult[]>;
  deleteBySourceId(sourceId: string, sectorId: string): Promise<void>;
}
```

> **Current implementation**: `PineconeVectorStoreService` (Infrastructure layer)

📚 See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed schema and setup.

---

## 🔐 Security Architecture

Context.AI implements a **multi-layered security pipeline** applied globally via NestJS guards:

```
Request → ThrottlerGuard → JwtAuthGuard → RBACGuard → Controller → Response
              │                 │              │
         429 Too Many      401 Unauth     403 Forbidden
```

| Layer | Guard | Purpose |
|-------|-------|---------|
| 1. Rate Limiting | `ThrottlerGuard` | 3-tier DDoS protection + AI-specific limits |
| 2. Authentication | `JwtAuthGuard` | Auth0 JWT validation via JWKS (RS256) |
| 3. Authorization | `RBACGuard` | Permission & role-based access control |
| 4. Audit | `AuditService` | 13 security event types logged to PostgreSQL |

### RBAC Model

```
Users ──M:N──▸ Roles ──M:N──▸ Permissions
```

| Role | Level | Key Permissions |
|------|-------|-----------------|
| `user` | Basic | `chat:read`, `knowledge:read`, `profile:read`, `profile:update` |
| `manager` | Content | user + `knowledge:create`, `knowledge:update`, `knowledge:delete`, `users:read` |
| `admin` | Full | All permissions (includes `users:manage`, `system:admin`) |

### Decorators

- `@Public()` — Bypass authentication for specific routes
- `@RequirePermissions([...])` — Require specific permissions (AND/OR modes)
- `@RequireRoles(...)` — Require specific roles
- `@CurrentUser()` — Extract validated user from JWT

📚 See [SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md) for OWASP compliance, [AUTH0_SETUP.md](AUTH0_SETUP.md) for Auth0 config, [RATE_LIMITING.md](RATE_LIMITING.md) for rate limits, [TOKEN_REVOCATION.md](TOKEN_REVOCATION.md) for logout.

---

## 🔧 Shared Module

The `src/shared/` directory contains cross-cutting utilities:

```
shared/
├── genkit/              # Google Genkit configuration
│   ├── genkit.config.ts # Genkit instance + GENKIT_CONFIG constants
│   ├── evaluators/      # RAG response quality evaluation
│   │   ├── evaluation.types.ts        # Zod schemas, types, thresholds
│   │   ├── rag-evaluator.service.ts   # LLM-as-judge (Faithfulness + Relevancy)
│   │   └── index.ts
│   └── flows/           # RAG query flow
│       └── rag-query.flow.ts
├── prompts/             # Prompt engineering
│   └── prompt.service.ts
├── types/               # Shared types and enums
│   └── enums/           # SourceType, SourceStatus
├── validators/          # Custom validators
│   ├── required-field.validator.ts
│   └── uuid.validator.ts
├── utils/               # Utility functions
│   └── error.utils.ts
├── decorators/          # Custom decorators
├── filters/             # Exception filters
├── guards/              # Shared guards
└── interceptors/        # Shared interceptors
```

### Genkit Configuration (`GENKIT_CONFIG`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `LLM_MODEL` | `vertexai/gemini-2.5-flash` | LLM for chat and RAG responses |
| `EMBEDDING_MODEL` | `vertexai/gemini-embedding-001` | Embedding generation (3072 dim) |
| `EMBEDDING_DIMENSIONS` | `3072` | Vector dimensions for Pinecone index |
| `GENERATION_DEFAULTS` | temp: 0.7, tokens: 2048 | Creative generation config |
| `RAG_GENERATION_CONFIG` | temp: 0.3, tokens: 1024 | Conservative/factual RAG config |
| `EVALUATION_CONFIG` | temp: 0.1, tokens: 512 | LLM-as-judge evaluator config |

📚 See [src/shared/genkit/README.md](../src/shared/genkit/README.md) for Genkit-specific details.

---

## 🎨 Key Design Patterns

### Repository Pattern

Abstract data access to separate domain logic from persistence:

```typescript
// Domain interface (simplified — see full interface in knowledge.repository.interface.ts)
export interface IKnowledgeRepository {
  saveSource(source: KnowledgeSource): Promise<KnowledgeSource>;
  findSourceById(id: string): Promise<KnowledgeSource | null>;
  findSourcesBySector(sectorId: string, includeDeleted?: boolean): Promise<KnowledgeSource[]>;
  softDeleteSource(id: string): Promise<void>;
  saveFragments(fragments: Fragment[]): Promise<Fragment[]>;
  deleteFragmentsBySource(sourceId: string): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

// Infrastructure implementation
@Injectable()
export class KnowledgeRepository implements IKnowledgeRepository {
  constructor(
    @InjectRepository(KnowledgeSourceModel)
    private sourceRepository: Repository<KnowledgeSourceModel>,
  ) {}

  async saveSource(source: KnowledgeSource): Promise<KnowledgeSource> {
    const model = KnowledgeSourceMapper.toPersistence(source);
    const saved = await this.sourceRepository.save(model);
    return KnowledgeSourceMapper.toDomain(saved);
  }
}
```

### Dependency Injection

Use NestJS IoC container for all dependencies:

```typescript
@Injectable()
export class IngestDocumentUseCase {
  constructor(
    private readonly documentParser: DocumentParserService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly repository: IKnowledgeRepository,
  ) {}
}
```

### DTO Pattern

Input validation and transformation at the presentation layer:

```typescript
export class UploadDocumentDto {
  @ApiProperty({ example: 'My Document' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  sourceType: SourceType;
}
```

### Mapper Pattern

Convert between domain entities and database models (and DTOs):

```typescript
export class KnowledgeSourceMapper {
  static toDomain(model: KnowledgeSourceModel): KnowledgeSource {
    return new KnowledgeSource({
      title: model.title,
      sectorId: model.sectorId,
      sourceType: model.sourceType,
      content: model.content,
      metadata: model.metadata,
    });
  }

  static toPersistence(entity: KnowledgeSource): KnowledgeSourceModel {
    const model = new KnowledgeSourceModel();
    model.id = entity.id;
    model.title = entity.title;
    model.sectorId = entity.sectorId;
    // ...
    return model;
  }
}
```

### Guard Pipeline Pattern

Global security applied via `APP_GUARD` in execution order:

```typescript
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },   // 1. Rate limiting
  { provide: APP_GUARD, useExisting: JwtAuthGuard },   // 2. Authentication
  { provide: APP_GUARD, useExisting: RBACGuard },      // 3. Authorization
]
```

---

## 📁 Module Structure

Each feature module follows this Clean Architecture structure:

```
knowledge/
├── domain/
│   ├── entities/
│   │   ├── knowledge-source.entity.ts
│   │   └── fragment.entity.ts
│   ├── repositories/
│   │   └── knowledge.repository.interface.ts
│   ├── services/
│   │   └── vector-store.interface.ts
│   └── value-objects/
├── application/
│   ├── use-cases/
│   │   ├── ingest-document.use-case.ts
│   │   └── delete-source.use-case.ts
│   └── dtos/
│       ├── ingest-document.dto.ts
│       └── delete-source.dto.ts
├── infrastructure/
│   ├── services/
│   │   ├── document-parser.service.ts
│   │   ├── chunking.service.ts
│   │   ├── embedding.service.ts
│   │   └── pinecone-vector-store.service.ts
│   ├── persistence/
│   │   ├── models/
│   │   │   ├── knowledge-source.model.ts
│   │   │   └── fragment.model.ts
│   │   ├── mappers/
│   │   │   ├── knowledge-source.mapper.ts
│   │   │   └── fragment.mapper.ts
│   │   └── repositories/
│   │       └── knowledge.repository.ts
│   └── pinecone/
│       └── pinecone.module.ts
├── presentation/
│   ├── knowledge.controller.ts
│   └── dtos/
│       └── knowledge.dto.ts
└── knowledge.module.ts
```

---

## 🔄 Data Flow

### Document Ingestion Flow

```
HTTP POST (file) → KnowledgeController
    ↓
  DTO Validation (class-validator)
    ↓
  IngestDocumentUseCase (Application)
    ↓
  DocumentParserService → Extract text from PDF/Markdown
    ↓
  ChunkingService → Split into semantic fragments
    ↓
  EmbeddingService → Generate embeddings via Genkit (gemini-embedding-001)
    ↓
  KnowledgeRepository → Save source + fragments to PostgreSQL
    ↓
  PineconeVectorStoreService → Upsert embeddings to Pinecone
    ↓
  Response: { sourceId, fragmentsCreated, status }
```

### RAG Query Flow

```
HTTP POST (query) → InteractionController
    ↓
  DTO Validation + JWT Auth + RBAC Check
    ↓
  QueryAssistantUseCase (Application)
    ↓
  Get/Create Conversation → ConversationRepository (PostgreSQL)
    ↓
  Build Contextual Query (with conversation history)
    ↓
  RAG Query Flow (shared/genkit):
    1. Embed query → Genkit (gemini-embedding-001)
    2. Vector search → Pinecone (by sectorId namespace)
    3. Filter by similarity threshold (≥ 0.7)
    4. Build prompt with context fragments
    5. Generate response → Genkit (Gemini 2.5 Flash)
    6. Evaluate response → RagEvaluatorService (Faithfulness + Relevancy in parallel)
    ↓
  Save Messages → ConversationRepository (user + assistant messages with eval metadata)
    ↓
  Response: { response, conversationId, sources[], timestamp, evaluation? }
```

---

## ✅ Architecture Principles

1. **Dependency Rule**: Dependencies point inward (Infrastructure → Application → Domain)
2. **Single Responsibility**: Each layer has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Liskov Substitution**: Interfaces over implementations (e.g., `IVectorStore`)
5. **Interface Segregation**: Many specific interfaces over one general-purpose interface
6. **Dependency Inversion**: Depend on abstractions, not concretions

---

## 🚫 What NOT to Do

1. ❌ Don't import Infrastructure into Domain
2. ❌ Don't put business logic in Controllers
3. ❌ Don't access Database directly from Use Cases
4. ❌ Don't mix concerns across layers
5. ❌ Don't create circular dependencies
6. ❌ Don't use `any` type — ever
7. ❌ Don't disable ESLint rules without justification
8. ❌ Don't skip validation (lint + build + test)

---

## 📚 Related Documentation

| Topic | Document |
|-------|----------|
| Auth0 Setup | [AUTH0_SETUP.md](AUTH0_SETUP.md) |
| Security & OWASP | [SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md) |
| Security Practices | [SECURITY.md](SECURITY.md) |
| Database & Schema | [DATABASE_SETUP.md](DATABASE_SETUP.md) |
| Environment Variables | [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) |
| Rate Limiting | [RATE_LIMITING.md](RATE_LIMITING.md) |
| Token Revocation | [TOKEN_REVOCATION.md](TOKEN_REVOCATION.md) |
| RBAC Seeding | [RBAC_SEEDING_STRATEGY.md](RBAC_SEEDING_STRATEGY.md) |
| Testing | [TESTING_GUIDELINES.md](TESTING_GUIDELINES.md) |
| Branching Strategy | [BRANCHING_STRATEGY.md](BRANCHING_STRATEGY.md) |
| Swagger / API Docs | [SWAGGER.md](SWAGGER.md) |
| Genkit Configuration | [src/shared/genkit/README.md](../src/shared/genkit/README.md) |

---

## 📖 References

- **Clean Architecture**: Robert C. Martin
- **Domain-Driven Design**: Eric Evans
- **NestJS Architecture**: https://docs.nestjs.com/fundamentals/custom-providers
- **Google Genkit**: https://genkit.dev/docs
- **Pinecone**: https://docs.pinecone.io/
- **Auth0**: https://auth0.com/docs

---

**Last Updated**: 2026-02-13
**Version**: 2.0.0 (Phase 6 — Complete MVP)
**Status**: ✅ Active
