# Architecture Guidelines

This document describes the architecture principles and patterns used in Context.AI API.

---

## 🏗️ Clean Architecture Layers

### Layer Structure

1. **Domain Layer** (`domain/`)
   - Pure business logic
   - No external dependencies
   - Entities with self-validation
   - Repository interfaces

2. **Application Layer** (`application/`)
   - Use cases (orchestration)
   - DTOs (Data Transfer Objects)
   - Business rules coordination

3. **Infrastructure Layer** (`infrastructure/`)
   - External services (Genkit, PDF parsing)
   - Database persistence (TypeORM)
   - Repository implementations

4. **Presentation Layer** (`presentation/`)
   - REST API controllers
   - Request/response handling
   - Swagger documentation

---

## 🎨 Key Design Patterns

### Repository Pattern
Abstract data access layer to separate domain logic from persistence concerns.

```typescript
// Domain interface
export interface IKnowledgeRepository {
  save(source: KnowledgeSource): Promise<KnowledgeSource>;
  findById(id: string): Promise<KnowledgeSource | null>;
}

// Infrastructure implementation
@Injectable()
export class KnowledgeRepository implements IKnowledgeRepository {
  constructor(
    @InjectRepository(KnowledgeSourceModel)
    private sourceRepository: Repository<KnowledgeSourceModel>,
  ) {}
  
  async save(source: KnowledgeSource): Promise<KnowledgeSource> {
    const model = KnowledgeSourceMapper.toPersistence(source);
    const saved = await this.sourceRepository.save(model);
    return KnowledgeSourceMapper.toDomain(saved);
  }
}
```

### Dependency Injection
Use NestJS IoC container for all dependencies.

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
Input validation and transformation at the presentation layer.

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
Convert between domain entities and database models.

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

---

## 📁 Module Structure

Each feature module follows this structure:

```
knowledge/
├── domain/
│   ├── entities/
│   │   ├── knowledge-source.entity.ts
│   │   └── fragment.entity.ts
│   └── repositories/
│       └── knowledge.repository.interface.ts
├── application/
│   ├── use-cases/
│   │   └── ingest-document.use-case.ts
│   └── dtos/
│       ├── ingest-document.dto.ts
│       └── ingest-document-response.dto.ts
├── infrastructure/
│   ├── services/
│   │   ├── document-parser.service.ts
│   │   ├── chunking.service.ts
│   │   └── embedding.service.ts
│   └── persistence/
│       ├── models/
│       │   ├── knowledge-source.model.ts
│       │   └── fragment.model.ts
│       ├── mappers/
│       │   ├── knowledge-source.mapper.ts
│       │   └── fragment.mapper.ts
│       └── repositories/
│           └── knowledge.repository.ts
└── presentation/
    └── knowledge.controller.ts
```

---

## 🔄 Data Flow

```
HTTP Request → Controller (Presentation)
    ↓
  DTO Validation
    ↓
Use Case (Application)
    ↓
Services (Infrastructure) ← → Domain Entities
    ↓
Repository (Infrastructure)
    ↓
Database Models (TypeORM)
    ↓
PostgreSQL + Pinecone
```

---

## ✅ Architecture Principles

1. **Dependency Rule**: Dependencies point inward (Infrastructure → Application → Domain)
2. **Single Responsibility**: Each layer has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Liskov Substitution**: Interfaces over implementations
5. **Interface Segregation**: Many specific interfaces over one general-purpose interface
6. **Dependency Inversion**: Depend on abstractions, not concretions

---

## 🚫 What NOT to Do

1. ❌ Don't import Infrastructure into Domain
2. ❌ Don't put business logic in Controllers
3. ❌ Don't access Database directly from Use Cases
4. ❌ Don't mix concerns across layers
5. ❌ Don't create circular dependencies

---

## 📚 References

- **Clean Architecture**: Robert C. Martin
- **Domain-Driven Design**: Eric Evans
- **NestJS Architecture**: https://docs.nestjs.com/fundamentals/custom-providers

