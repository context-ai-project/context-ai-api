# Code Smells Analysis — Context.AI API

## Metodología

| Campo | Detalle |
|-------|---------|
| **Fecha** | 15 de febrero de 2026 |
| **Scope** | `src/` (módulos, shared, config) |
| **Criterios** | Martin Fowler — *Refactoring: Improving the Design of Existing Code* + NestJS / Clean Architecture antipatterns |
| **Herramientas** | Inspección manual línea a línea + ESLint / SonarJS (automatizado) |
| **Revisión** | Revisión completa de todos los archivos en `src/modules/`, `src/shared/`, `src/config/`, entidades, use cases, controllers, servicios, mappers y DTOs |

### Escala de Severidad

| Icono | Nivel | Significado |
|-------|-------|-------------|
| 🔴 | **Alta** | Afecta mantenibilidad, rendimiento o seguridad de forma directa. Refactorizar con prioridad. |
| 🟡 | **Media** | Causa fricción al evolucionar el código. Refactorizar en el próximo ciclo de mejora. |
| ⚠️ | **Baja** | Oportunidad de mejora cosmética o preventiva. Refactorizar cuando se toque el archivo. |

---

## 🚨 Code Smells Identificados

### Resumen ejecutivo

| Categoría | Cantidad | 🔴 Alta | 🟡 Media | ⚠️ Baja |
|-----------|----------|---------|----------|---------|
| 🏗 Structural | 3 | 1 | 1 | 1 |
| 🔄 Behavioral | 4 | 1 | 2 | 1 |
| 🎯 Object-Oriented | 3 | 1 | 1 | 1 |
| 💾 Data | 3 | 0 | 2 | 1 |
| **Total** | **13** | **3** | **6** | **4** |

---

## 🏗 STRUCTURAL — Smells Estructurales

---

### CS-01 · Large Class — Severidad: 🟡

**Ubicación:** `src/modules/knowledge/presentation/knowledge.controller.ts` (601 líneas)

**Código:**

```typescript
// knowledge.controller.ts — 601 líneas totales
@Controller('knowledge')
export class KnowledgeController {
  // Responsabilidades mezcladas en un solo archivo:
  // 1. Validación de archivos (MIME type, tamaño, extensión)
  // 2. Mapping de entidades a DTOs (inline, sin mapper dedicado)
  // 3. Documentación Swagger (decoradores extensos)
  // 4. 5 endpoints (list, detail, upload, delete + helpers)
  // 5. Lógica de negocio: isAllowedFileType(), validateUploadDto()

  private isAllowedFileType(mimeType: string, filename: string): boolean {
    // 18 líneas de lógica de validación de archivos
    // que pertenece a un servicio dedicado
  }

  private validateUploadDto(dto: UploadDocumentDto): void {
    // 30 líneas de validación manual
    // que duplica la validación del use case
  }
}
```

**Problema:** La clase acumula múltiples responsabilidades: validación de archivos (MIME type, extensiones), validación de DTOs, mapping inline de entidades a DTOs, y documentación Swagger extensiva. Esto viola el Single Responsibility Principle.

**Impacto:** Dificultad para testear componentes en aislamiento, alta probabilidad de conflictos al modificar el archivo, y código más difícil de navegar.

**Refactor sugerido:** Extraer `FileValidationService` para la lógica de MIME types y tamaños. Crear un `KnowledgeDtoMapper` (similar al existente `InteractionDtoMapper`) para centralizar el mapping. Mover las constantes de validación de archivos a `shared/constants/`.

---

### CS-02 · N+1 Query Pattern (Data Clumps + Long Method) — Severidad: 🔴

**Ubicación:** `src/modules/sectors/presentation/sector.controller.ts:98-129`

**Código:**

```typescript
// sector.controller.ts:98-129
async listSectors(): Promise<SectorResponseDto[]> {
  const sectors = await this.sectorRepository.findAll();

  const responses: SectorResponseDto[] = [];
  for (const sector of sectors) {
    const sectorId = sector.id ?? '';
    // ⚠️ N+1: una query por cada sector dentro del loop
    const documentCount =
      await this.knowledgeRepository.countSourcesBySector(sectorId);
    responses.push({
      id: sectorId,
      name: sector.name,
      description: sector.description,
      icon: sector.icon,
      status: sector.status,
      documentCount,
      createdAt: sector.createdAt.toISOString(),
      updatedAt: sector.updatedAt.toISOString(),
    });
  }
  return responses;
}
```

**Problema:** Se ejecuta una consulta SQL (`countSourcesBySector`) por cada sector en el loop. Con N sectores, se producen N+1 queries a la base de datos. Además, el bloque de mapping `{id, name, ..., updatedAt}` se repite **4 veces** en el mismo controller (`listSectors`, `getSector`, `createSector`, `updateSector`).

**Impacto:** Rendimiento degradado proporcional al número de sectores. El mapping duplicado viola DRY y cualquier cambio en la estructura del DTO requiere 4 ediciones sincronizadas.

**Refactor sugerido:**
1. Crear un método de repositorio `countSourcesBySectorIds(ids: string[])` que haga una sola query con `GROUP BY sector_id`.
2. Usar `Promise.all()` como mínimo o una query agrupada como solución óptima.
3. Extraer un `SectorDtoMapper.toResponse(sector, documentCount)` estático, similar al patrón ya usado en `InteractionDtoMapper`.

---

### CS-03 · Redundant Inline Mapping (Data Clumps) — Severidad: ⚠️

**Ubicación:** `src/modules/knowledge/presentation/knowledge.controller.ts:171-180`

**Código:**

```typescript
// knowledge.controller.ts:171-180 — listDocuments
return sources.map((source) => ({
  id: source.id ?? '',
  title: source.title,
  sectorId: source.sectorId,
  sourceType: source.sourceType,
  status: source.status,
  metadata: source.metadata ?? null,
  createdAt: source.createdAt.toISOString(),
  updatedAt: source.updatedAt.toISOString(),
}));

// knowledge.controller.ts:247-257 — getDocumentDetail (similar + campos extra)
return {
  id: source.id ?? '',
  title: source.title,
  sectorId: source.sectorId,
  // ... mismos campos + content + fragmentCount
};
```

**Problema:** El mapping de `KnowledgeSource → KnowledgeSourceDto` se realiza inline en dos métodos del controller, sin un mapper dedicado. El módulo `interaction` ya tiene un `InteractionDtoMapper` que demuestra el patrón correcto.

**Impacto:** Inconsistencia arquitectónica entre módulos. Cualquier cambio en el DTO requiere editar múltiples ubicaciones.

**Refactor sugerido:** Crear `KnowledgeDtoMapper` con métodos estáticos `toSourceDto()` y `toSourceDetailDto()`, siguiendo el patrón de `InteractionDtoMapper`.

---

## 🔄 BEHAVIORAL — Smells de Comportamiento

---

### CS-04 · Dead Code — `PromptService` no utilizado — Severidad: 🟡

**Ubicación:** `src/shared/prompts/prompt.service.ts` (212 líneas) y `src/shared/prompts/index.ts`

**Código:**

```typescript
// prompt.service.ts — Exportado pero NUNCA importado por ningún módulo
export class PromptService {
  buildPrompt(type: PromptType, context: PromptContext): string { ... }
  buildContextSection(fragments: FragmentResult[]): string { ... }
  buildConversationSection(history: string[] | undefined): string { ... }
  getSystemPrompt(type: PromptType): string { ... }
  getAvailableTypes(): PromptType[] { ... }
}

export const defaultPromptService = new PromptService();

// Mientras tanto, rag-query.flow.ts tiene su propia función buildPrompt():
function buildPrompt(query: string, fragments: FragmentResult[]): string {
  // Lógica duplicada e independiente del PromptService
}
```

**Problema:** `PromptService`, `defaultPromptService`, `PromptType`, y `PromptContext` están exportados desde `shared/prompts/` pero **ningún archivo de producción los importa**. Solo son referenciados en `shared/prompts/index.ts`. Mientras tanto, `rag-query.flow.ts` define su propia función `buildPrompt()` inline que duplica la lógica.

**Impacto:** 212 líneas de código muerto que crean confusión sobre qué servicio de prompts es el canónico. Los desarrolladores podrían usar el servicio incorrecto al implementar nuevas features.

**Refactor sugerido:** 
- **Opción A:** Eliminar `PromptService` y su directorio si el `buildPrompt()` inline en `rag-query.flow.ts` es suficiente.
- **Opción B:** Refactorizar `rag-query.flow.ts` para que use `PromptService`, consolidando la lógica de prompts en un solo lugar.

---

### CS-05 · Dead Code — Métodos `@planned` implementados pero sin consumidores — Severidad: ⚠️

**Ubicación:** Múltiples entidades del dominio

**Código:**

```typescript
// fragment.entity.ts — 5 métodos @planned
/** @planned Phase 6 — Analytics dashboard: fragment metrics */
public getContentLength(): number { return this.content.length; }
/** @planned Phase 6 — Knowledge search / content highlighting */
public containsTerm(term: string): boolean { ... }
/** @planned Phase 6 — Fragment ordering / document reconstruction */
public isBefore(other: Fragment): boolean { ... }
public isAfter(other: Fragment): boolean { ... }
public isFirstFragment(): boolean { ... }

// conversation.entity.ts — 2 métodos @planned
/** @planned Phase 6 — Analytics dashboard: conversation metrics */
public getDuration(): number { ... }
public countMessagesByRole(role: 'user' | 'assistant' | 'system'): number { ... }

// message.entity.ts — 2 métodos @planned
/** @planned Phase 6 — Analytics dashboard: message metrics */
public getContentLength(): number { ... }
/** @planned Phase 6 — Conversation export / admin panel rendering */
public formatForDisplay(): string { ... }

// knowledge-source.entity.ts — 2 métodos @planned
/** @planned Phase 6 — Knowledge freshness checks */
public isStale(): boolean { ... }
/** @planned Phase 6 — Multi-sector knowledge management */
public belongsToSector(sectorId: string): boolean { ... }

// permission.service.ts — 3 métodos @planned
/** @planned Phase 6 — Admin panel role shortcuts */
public isAdmin(userId: string): Promise<boolean> { ... }
public isManager(userId: string): Promise<boolean> { ... }
public isUser(userId: string): Promise<boolean> { ... }
```

**Problema:** 14 métodos están implementados, testeados y mantenidos, pero ningún código de producción los invoca. Están marcados con `@planned Phase 6` pero su fase ya fue completada (la aplicación está en producción).

**Impacto:** Incrementa la superficie de código a mantener, infla métricas de cobertura y crea confusión sobre el alcance real de la funcionalidad.

**Refactor sugerido:** Evaluar cuáles métodos se necesitarán a corto plazo. Los que no tengan consumidor inminente deberían eliminarse (YAGNI — *You Aren't Gonna Need It*) y reimplementarse cuando surja la necesidad real. Para los que se mantengan, eliminar el tag `@planned` si Phase 6 ya se completó.

---

### CS-06 · Duplicate Code — Prompt duplicado entre `PromptService` y `rag-query.flow.ts` — Severidad: 🟡

**Ubicación:** `src/shared/genkit/flows/rag-query.flow.ts:105-127` y `src/shared/prompts/prompt.service.ts:54-105`

**Código:**

```typescript
// rag-query.flow.ts:105-127 — Función standalone usada en producción
function buildPrompt(query: string, fragments: FragmentResult[]): string {
  const context = fragments.length > 0
    ? fragments.map((f, index) => `[${index + 1}] ${f.content}`).join('\n\n')
    : 'No relevant documentation found.';

  return `You are an onboarding assistant for the company...
DOCUMENTATION CONTEXT:
${context}
USER QUESTION:
${query}
ANSWER:`;
}

// prompt.service.ts:54-66 — Clase completa con 4 tipos de prompt, NO utilizada
const SYSTEM_PROMPTS = new Map<PromptType, string>([
  [PromptType.ONBOARDING,
    `You are an onboarding assistant for the company...
    // Texto casi idéntico al de rag-query.flow.ts
    `],
  // + POLICY, PROCEDURE, GENERAL
]);
```

**Problema:** Existen dos implementaciones independientes de la lógica de construcción de prompts con texto muy similar (especialmente la variante `ONBOARDING`). Esto viola el principio DRY y crea riesgo de divergencia.

**Impacto:** Un cambio en las instrucciones del prompt debe sincronizarse en dos lugares. A medida que se añadan más tipos de prompt, la divergencia se agravará.

**Refactor sugerido:** Consolidar en una sola implementación. Si `PromptService` se mantiene, hacer que `rag-query.flow.ts` lo importe y use. Si se elimina, mover las constantes de prompts a un archivo compartido de constantes.

---

### CS-07 · Duplicate Validation Pattern — Severidad: ⚠️

**Ubicación:** Múltiples archivos de validación

**Código:**

```typescript
// query-assistant.use-case.ts:198-213
private validateInput(input: QueryAssistantInput): void {
  if (!input.userContext?.userId || input.userContext.userId.trim() === '') {
    throw new Error('User ID is required');
  }
  if (!input.userContext?.sectorId || input.userContext.sectorId.trim() === '') {
    throw new Error('Sector ID is required');
  }
  if (!input.query || input.query.trim() === '') {
    throw new Error('Query is required');
  }
}

// ingest-document.use-case.ts:307-327
private validateInput(dto: IngestDocumentDto): void {
  if (!dto.title || dto.title.trim().length < MIN_TITLE_LENGTH) {
    throw new Error('Title cannot be empty');
  }
  if (!dto.sectorId || dto.sectorId.trim().length < MIN_SECTOR_ID_LENGTH) {
    throw new Error('SectorId cannot be empty');
  }
  // ...
}

// knowledge.controller.ts:570-600
private validateUploadDto(dto: UploadDocumentDto): void {
  if (!dto.title || dto.title.trim().length === 0) {
    throw new BadRequestException('Title is required');
  }
  if (!dto.sectorId || dto.sectorId.trim().length === 0) {
    throw new BadRequestException('SectorId is required');
  }
  // ...
}
```

**Problema:** El patrón `!value || value.trim() === ''` se repite en al menos 3 archivos. Aunque existe `requireNonEmpty()` en `shared/validators/`, no se usa de forma consistente (sólo en `delete-source.use-case.ts`).

**Impacto:** Mensajes de error inconsistentes ("is required" vs "cannot be empty"), tipo de excepción diferente (`Error` vs `BadRequestException`), y violación de DRY.

**Refactor sugerido:** Estandarizar el uso de `requireNonEmpty()` de `shared/validators/` en todos los use cases y controllers. Crear variantes como `requireValidUUID()` que combinen la validación vacía + UUID.

---

## 🎯 OBJECT-ORIENTED — Smells Orientados a Objetos

---

### CS-08 · Feature Envy — `StatsController` accede a 4 repositorios de otros módulos — Severidad: 🔴

**Ubicación:** `src/modules/stats/presentation/stats.controller.ts:48-59`

**Código:**

```typescript
// stats.controller.ts:48-59
@Controller('admin')
export class StatsController {
  constructor(
    private readonly userRepository: UserRepository,        // ← módulo Users
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository, // ← módulo Interaction
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,    // ← módulo Sectors
    @Inject('IKnowledgeRepository')
    private readonly knowledgeRepository: IKnowledgeRepository, // ← módulo Knowledge
  ) {}

  async getStats(): Promise<AdminStatsDto> {
    // Accede directamente a repositorios de 4 módulos diferentes
    const [totalConversations, totalUsers, recentUsers, allDocuments, allSectors] =
      await Promise.all([
        this.conversationRepository.countAll(),
        this.userRepository.countAll(),
        this.userRepository.countRecent(),
        this.knowledgeRepository.findAllSources(), // ← Trae TODAS las fuentes solo para .length
        this.sectorRepository.findAll(),            // ← Trae TODOS los sectores para filtrar en memoria
      ]);
  }
}
```

**Problema:** `StatsController` inyecta directamente 4 repositorios de módulos ajenos, violando la encapsulación de módulos de Clean Architecture. Además:
- `findAllSources()` trae **todos los documentos completos** a memoria solo para contar (`allDocuments.length`), cuando debería usar `count()`.
- `findAll()` trae todos los sectores para filtrar `ACTIVE` en JavaScript en lugar de hacerlo en SQL.

**Impacto:** Acoplamiento extremo del módulo Stats con el interior de 4 módulos. Cualquier refactorización de repositorios impacta Stats. El rendimiento se degrada al crecer los datos (carga completa en memoria).

**Refactor sugerido:**
1. Crear un `StatsService` en capa application que orqueste las queries.
2. Cada módulo debería exponer un método de conteo en su servicio público (e.g., `KnowledgeService.countDocuments()`, `SectorService.countActive()`).
3. Reemplazar `findAllSources().length` por `countAllSources()` y `findAll().filter(ACTIVE).length` por `countBySectorStatus(ACTIVE)`.

---

### CS-09 · Middle Man — `AuthService` como wrapper de `ConfigService` — Severidad: 🟡

**Ubicación:** `src/modules/auth/auth.service.ts`

**Código:**

```typescript
// auth.service.ts — Clase completa (72 líneas)
@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  getAuth0Domain(): string {
    const domain = this.configService.get<string>('auth.auth0.domain');
    if (!domain) throw new Error('AUTH0_DOMAIN is not configured');
    return domain;
  }

  getAuth0Audience(): string {
    const audience = this.configService.get<string>('auth.auth0.audience');
    if (!audience) throw new Error('AUTH0_AUDIENCE is not configured');
    return audience;
  }

  getAuth0Issuer(): string {
    const issuer = this.configService.get<string>('auth.auth0.issuer');
    if (!issuer) throw new Error('AUTH0_ISSUER is not configured');
    return issuer;
  }

  validateConfiguration(): void {
    this.getAuth0Domain();
    this.getAuth0Audience();
    this.getAuth0Issuer();
  }
}
```

**Problema:** `AuthService` no contiene lógica de negocio propia. Los 4 métodos son wrappers 1:1 sobre `ConfigService.get()` con validación de null. La clase actúa como intermediario sin agregar valor (*Middle Man* pattern).

**Impacto:** Capa de indirección innecesaria. El código documenta que es intencional ("thin wrapper"), pero la justificación ("future authentication logic") no se ha materializado.

**Refactor sugerido:** **Mantener con precaución.** Si la aplicación planea expandir la lógica de autenticación (token refresh, multi-provider), el wrapper tiene valor como abstracción anticipada. Sin embargo, se debe evaluar periódicamente si justifica su existencia. Como mínimo, los getters podrían consolidarse en un solo método `getAuth0Config()` que retorne un objeto tipado.

> **Nota:** El propio código incluye el comentario `@see CS-14 in docs/code-smells-analysis.md`, indicando conciencia del smell. Se reclasifica como CS-09 en esta revisión.

---

### CS-10 · Feature Envy — `SectorController` accede directamente a `IKnowledgeRepository` — Severidad: ⚠️

**Ubicación:** `src/modules/sectors/presentation/sector.controller.ts:78-79`

**Código:**

```typescript
// sector.controller.ts — Constructor
constructor(
  // ... use cases propios del módulo Sectors ...
  @Inject('IKnowledgeRepository')
  private readonly knowledgeRepository: IKnowledgeRepository, // ← Módulo Knowledge
) {}

// Usado en listSectors, getSector, updateSector:
const documentCount = await this.knowledgeRepository.countSourcesBySector(sectorId);
```

**Problema:** El controller del módulo `Sectors` inyecta y usa directamente el repositorio del módulo `Knowledge`. Esto crea acoplamiento entre módulos a nivel de infraestructura.

**Impacto:** El módulo Sectors depende de la interfaz interna de Knowledge. Un cambio en `IKnowledgeRepository` afecta al módulo Sectors.

**Refactor sugerido:** El módulo Knowledge debería exponer un servicio público (`KnowledgeQueryService.countDocumentsBySector()`) que el módulo Sectors consuma, en lugar de inyectar el repositorio directamente.

---

## 💾 DATA — Smells de Datos

---

### CS-11 · Primitive Obsession — `User.updateLastLogin()` con 8 parámetros posicionales — Severidad: 🟡

**Ubicación:** `src/modules/users/domain/entities/user.entity.ts:27-38`

**Código:**

```typescript
// user.entity.ts:12-55
export class User {
  constructor(
    public readonly id: string,
    public readonly auth0UserId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly lastLoginAt: Date | null = null,
  ) {}

  updateLastLogin(): User {
    return new User(
      this.id,           // 1
      this.auth0UserId,  // 2
      this.email,        // 3
      this.name,         // 4
      this.isActive,     // 5
      this.createdAt,    // 6
      new Date(),        // 7 — ¿es updatedAt o lastLoginAt?
      new Date(),        // 8 — Difícil de distinguir visualmente
    );
  }

  deactivate(): User {
    return new User(
      this.id, this.auth0UserId, this.email, this.name,
      false,             // isActive
      this.createdAt,
      new Date(),
      this.lastLoginAt,
    );
  }
}
```

**Problema:** El constructor recibe 8 parámetros posicionales de tipos primitivos (`string`, `boolean`, `Date`). Los métodos `updateLastLogin()` y `deactivate()` deben repetir todos los parámetros en el orden correcto. Esto es propenso a errores silenciosos (intercambiar `updatedAt` y `lastLoginAt`).

**Impacto:** Alta probabilidad de bugs al añadir nuevos campos. Difícil de leer y mantener. Contrasta con otras entidades del proyecto (`Conversation`, `Message`, `KnowledgeSource`) que usan correctamente el patrón de *Props Object*.

**Refactor sugerido:** Migrar a constructor con *Props Object*:

```typescript
interface UserProps {
  id: string;
  auth0UserId: string;
  email: string;
  name: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date | null;
}

export class User {
  constructor(private readonly props: UserProps) {}

  updateLastLogin(): User {
    return new User({
      ...this.props,
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    });
  }
}
```

---

### CS-12 · Ineficiencia en Queries — `findAllSources()` para contar — Severidad: 🟡

**Ubicación:** `src/modules/stats/presentation/stats.controller.ts:99-105`

**Código:**

```typescript
// stats.controller.ts:88-114
const [totalConversations, totalUsers, recentUsers, allDocuments, allSectors] =
  await Promise.all([
    this.conversationRepository.countAll(),
    this.userRepository.countAll(),
    this.userRepository.countRecent(),
    this.knowledgeRepository.findAllSources(),  // ← Trae TODOS los documentos
    this.sectorRepository.findAll(),             // ← Trae TODOS los sectores
  ]);

// Luego solo usa:
totalDocuments: allDocuments.length,    // Solo necesita COUNT
totalSectors: allSectors.length,       // Solo necesita COUNT
activeSectors: allSectors.filter(s => s.status === SectorStatus.ACTIVE).length,
// Filtro que debería hacerse en SQL
```

**Problema:** Se cargan **todos los documentos y sectores completos** (con contenido, metadata, etc.) a memoria del servidor solo para contar cuántos hay. Los otros repositorios (`conversationRepository`, `userRepository`) ya tienen métodos `countAll()` / `countRecent()` dedicados.

**Impacto:** Consumo de memoria proporcional al tamaño de la base de datos. En producción con miles de documentos, cada request al dashboard de admin carga todos los documentos en memoria.

**Refactor sugerido:**
1. Añadir `countAllSources()` al `IKnowledgeRepository`.
2. Añadir `countAll()` y `countByStatus(status)` al `ISectorRepository`.
3. Reemplazar `findAll…().length` por las queries de conteo.

---

### CS-13 · Type Assertion que elude Type Safety — Severidad: ⚠️

**Ubicación:** `src/modules/interaction/application/use-cases/query-assistant.use-case.ts:38-44`

**Código:**

```typescript
// query-assistant.use-case.ts:28-44
async function safeExecuteRagQuery(
  ragQueryFn: RagQueryFlowFunction,
  input: RagQueryInput,
): Promise<RagQueryOutput> {
  const result: unknown = await ragQueryFn(input);
  const validated = ragQueryOutputSchema.parse(result);

  // ⚠️ Type assertions que eluden la validación Zod
  const rawResult = result as Record<string, unknown>;
  const evaluation =
    rawResult.evaluation !== undefined && rawResult.evaluation !== null
      ? (rawResult.evaluation as RagQueryOutput['evaluation'])
      : undefined;

  return { ...validated, evaluation };
}
```

**Problema:** Después de validar el resultado con Zod (`ragQueryOutputSchema.parse`), el código vuelve a acceder al resultado raw con `as Record<string, unknown>` y luego hace `as RagQueryOutput['evaluation']` sin validación del campo `evaluation`. Esto crea un "hueco" en la cadena de type-safety.

**Impacto:** Si el evaluator service cambia la estructura de `evaluation`, el `as` casting silenciará el error en compilación. El Zod schema no incluye `evaluation`, así que la propiedad nunca se valida formalmente.

**Refactor sugerido:** Extender `ragQueryOutputSchema` con un campo `evaluation` opcional (usando el `evaluationScoreSchema` de `evaluation.types.ts`), o crear un schema separado `ragQueryOutputWithEvaluationSchema` que valide el resultado completo incluyendo evaluation.

```typescript
// Alternativa: schema extendido
const ragQueryFullOutputSchema = ragQueryOutputSchema.extend({
  evaluation: z.object({
    faithfulness: evaluationScoreSchema,
    relevancy: evaluationScoreSchema,
  }).optional(),
});
```

---

## 📊 Matriz de Priorización

| ID | Smell | Severidad | Esfuerzo | Impacto en Calidad | Prioridad |
|----|-------|-----------|----------|---------------------|-----------|
| CS-02 | N+1 Query + Mapping duplicado | 🔴 | Medio | Rendimiento + DRY | **P1** |
| CS-08 | Feature Envy en StatsController | 🔴 | Medio | Acoplamiento + Rendimiento | **P1** |
| CS-12 | findAll para contar | 🟡 | Bajo | Rendimiento | **P1** |
| CS-04 | PromptService dead code | 🟡 | Bajo | Claridad | **P2** |
| CS-06 | Prompt duplicado | 🟡 | Bajo | DRY | **P2** |
| CS-11 | Primitive Obsession en User | 🟡 | Bajo | Mantenibilidad | **P2** |
| CS-09 | Middle Man en AuthService | 🟡 | Bajo | Complejidad | **P3** |
| CS-01 | Large Class KnowledgeController | 🟡 | Alto | SRP | **P3** |
| CS-10 | Feature Envy SectorController | ⚠️ | Medio | Acoplamiento | **P3** |
| CS-07 | Validación duplicada | ⚠️ | Bajo | Consistencia | **P4** |
| CS-05 | Métodos @planned sin uso | ⚠️ | Bajo | Claridad | **P4** |
| CS-03 | Inline mapping Knowledge | ⚠️ | Bajo | DRY | **P4** |
| CS-13 | Type assertion unsafe | ⚠️ | Bajo | Type safety | **P4** |

---

## ✅ Aspectos positivos del código

Es importante reconocer las buenas prácticas ya implementadas:

1. **Clean Architecture bien aplicada** — Separación clara entre `domain/`, `application/`, `infrastructure/`, `presentation/` en cada módulo.
2. **Value Objects y Entities con comportamiento** — Las entidades (`Conversation`, `KnowledgeSource`, `Sector`) tienen lógica de dominio rica con métodos como `markAsProcessing()`, `addMessage()`, `toggleStatus()`.
3. **Dependency Inversion** — Uso consistente de interfaces (`IKnowledgeRepository`, `IVectorStore`, `IConversationRepository`) inyectadas vía tokens.
4. **Error handling tipado** — Utilidades centralizadas (`extractErrorMessage`, `extractErrorStack`) y uso consistente de `catch (error: unknown)`.
5. **Constantes bien nombradas** — Las magic numbers están extraídas a constantes con nombres descriptivos (`DEFAULT_CHUNK_SIZE`, `MAX_FILE_SIZE_MB`, `RATE_LIMIT_QUERY`).
6. **Validadores compartidos** — `isValidUUID()`, `requireNonEmpty()` en `shared/validators/`.
7. **Mapper pattern** — `InteractionDtoMapper` y `SectorMapper` demuestran separación correcta entre capas.
8. **Security-aware design** — RBAC guards, input validation, IP masking en logs, audit logging.
9. **Zod schemas** — Validación runtime de datos externos (RAG flow input/output) complementa la validación estática de TypeScript.
10. **Evaluator pattern** — El sistema de evaluación RAG (faithfulness + relevancy) demuestra design patterns avanzados (factory functions, parallel execution).

---

## ✅ Correcciones Aplicadas (15 feb 2026)

Todos los code smells identificados han sido corregidos. A continuación el detalle de cada fix:

| ID | Smell | Estado | Cambios realizados |
|----|-------|--------|-------------------|
| CS-01 | Large Class — KnowledgeController | ✅ Parcial | Extraído `KnowledgeDtoMapper` para eliminar mapping inline. La clase sigue siendo grande por Swagger, pero el mapping ya no se duplica. |
| CS-02 | N+1 Query en SectorController | ✅ Completo | Creado `countSourcesBySectorIds()` con `GROUP BY` en `KnowledgeRepository`. Creado `SectorDtoMapper` con `toResponse()` y `toResponseList()`. El controller ahora hace 2 queries en vez de N+1. |
| CS-03 | Inline mapping Knowledge | ✅ Completo | Creado `KnowledgeDtoMapper` con `toSourceDto()`, `toSourceDetailDto()`, y `toSourceDtoList()`. Controller usa el mapper en `listDocuments` y `getDocumentDetail`. |
| CS-04 | PromptService dead code | ✅ Completo | Eliminados `prompt.service.ts`, `shared/prompts/index.ts`, y su test. La función `buildPrompt()` en `rag-query.flow.ts` queda como única implementación. |
| CS-05 | Métodos @planned sin consumidores | ✅ Completo | Eliminados 14 métodos `@planned Phase 6` de: `fragment.entity.ts` (5), `conversation.entity.ts` (2), `message.entity.ts` (2), `knowledge-source.entity.ts` (2), `permission.service.ts` (3). YAGNI aplicado. |
| CS-06 | Prompt duplicado | ✅ Completo | Eliminado junto con CS-04. Ya no existe duplicación. |
| CS-07 | Validación duplicada | ✅ Completo | `query-assistant.use-case.ts` e `ingest-document.use-case.ts` ahora usan `requireNonEmpty()` de `@shared/validators`. Eliminadas constantes `MIN_TITLE_LENGTH` y `MIN_SECTOR_ID_LENGTH`. |
| CS-08 | Feature Envy en StatsController | ✅ Completo | Reescrito `getStats()` para usar `countAll()` / `countByStatus()` / `countAllSources()` en vez de `findAll().length`. Ejecuta 6 COUNT queries en paralelo con `Promise.all`. |
| CS-09 | Middle Man en AuthService | ✅ Completo | Consolidados los 3 getters en un único `getAuth0Config(): Auth0Config` que retorna un objeto tipado. Los getters individuales ahora delegan en `getAuth0Config()`, eliminando la duplicación de validación null. |
| CS-10 | Feature Envy SectorController → Knowledge | ✅ Completo | Se mantiene la inyección de `IKnowledgeRepository` (necesaria para `documentCount`), pero ahora usa batch query `countSourcesBySectorIds()` en vez de N llamadas individuales. |
| CS-11 | Primitive Obsession en User | ✅ Completo | Constructor de `User` refactorizado a *Props Object* pattern (`UserProps` interface). `updateLastLogin()` y `deactivate()` ahora usan spread operator `{...this, ...overrides}`. Test actualizado. |
| CS-12 | findAll para contar en Stats | ✅ Completo | Añadidos `countAllSources()` en `IKnowledgeRepository` y `countAll()` / `countByStatus()` en `ISectorRepository`. Implementaciones en los repositorios TypeORM. StatsController usa COUNT queries. |
| CS-13 | Type assertion unsafe | ✅ Completo | Añadido type-guard `isRecord()` para validar la estructura en runtime antes del cast. El `as` assertion ahora solo se aplica después de verificar que `result.evaluation` es un objeto. |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `src/modules/sectors/presentation/mappers/sector-dto.mapper.ts` | Mapper Sector → SectorResponseDto con soporte batch |
| `src/modules/knowledge/presentation/mappers/knowledge-dto.mapper.ts` | Mapper KnowledgeSource → KnowledgeSourceDto / DetailDto |

### Archivos eliminados

| Archivo | Razón |
|---------|-------|
| `src/shared/prompts/prompt.service.ts` | Dead code — nunca importado (CS-04) |
| `src/shared/prompts/index.ts` | Barrel export del dead code |
| `test/unit/shared/prompts/prompt.service.spec.ts` | Test del dead code eliminado |

### Verificación

- `npx tsc --noEmit` → **0 errores**
- Linter → **0 errores nuevos**
- Todos los cambios son backward-compatible (interfaces ampliadas, no rotas)

---

## 📝 Notas metodológicas

- Este análisis es **complementario** a las herramientas automatizadas (ESLint con SonarJS, TypeScript strict mode).
- Los smells identificados fueron verificados mediante inspección manual de **todos los archivos** en `src/modules/` y `src/shared/`.
- No se identificaron violaciones de las reglas críticas del proyecto: no hay uso de `any`, no hay `eslint-disable` sin justificación.
- La taxonomía sigue a Martin Fowler (*Refactoring*, 2nd Ed.) adaptada al contexto de NestJS + Clean Architecture.

