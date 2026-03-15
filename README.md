# Context.ai API

[![CI](https://github.com/context-ai-project/context-ai-api/actions/workflows/ci.yml/badge.svg)](https://github.com/context-ai-project/context-ai-api/actions/workflows/ci.yml)
[![CodeQL](https://github.com/context-ai-project/context-ai-api/actions/workflows/codeql.yml/badge.svg)](https://github.com/context-ai-project/context-ai-api/actions/workflows/codeql.yml)
[![Snyk Security](https://github.com/context-ai-project/context-ai-api/actions/workflows/snyk.yml/badge.svg)](https://github.com/context-ai-project/context-ai-api/actions/workflows/snyk.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Backend API para **Context.ai**, un sistema de gestión de conocimiento basado en **RAG (Retrieval-Augmented Generation)** que permite a las organizaciones crear bases de conocimiento sectoriales, procesarlas con inteligencia artificial y consultar información a través de un asistente conversacional.

## 🎯 Funcionalidades Principales

- **Gestión de Conocimiento**: Ingesta de documentos (PDF, texto), fragmentación automática con chunking inteligente y generación de embeddings vectoriales
- **Asistente RAG Conversacional**: Consultas en lenguaje natural con respuestas contextualizadas basadas en la base de conocimiento, con citas a fuentes originales
- **Historial de Conversaciones**: Persistencia de conversaciones y mensajes con soporte de contexto conversacional multi-turno
- **Multi-tenancy por Sectores**: Aislamiento completo de conocimiento por sector organizacional
- **Autenticación con Auth0**: Validación de JWT vía JWKS (RS256) con soporte OAuth2
- **Autorización RBAC**: Sistema interno de roles (`admin`, `manager`, `user`) y permisos granulares verificados contra base de datos
- **Revocación de Tokens**: Mecanismo de invalidación inmediata de JWTs comprometidos
- **Auditoría**: Registro automático de eventos de seguridad y acciones de usuario
- **Rate Limiting**: Protección contra abuso y DDoS por endpoint con `@nestjs/throttler`
- **Documentación API**: Swagger UI interactiva con autenticación JWT integrada
- **Cápsulas multimedia (audio y vídeo)**: Creación de cápsulas de audio (TTS con ElevenLabs) y de vídeo (guion generado por IA, imágenes Imagen 3, montaje con Shotstack); almacenamiento en GCS; pipeline asíncrono (Cloud Tasks en producción)
- **Invitaciones de usuarios**: Flujo de invitación por correo (Auth0 M2M + user tickets), sin registro público
- **Notificaciones in-app**: Notificaciones event-driven, marcado de leídas y contador
- **Gestión de sectores (CRUD)**: Creación, edición y activación/desactivación de sectores (espacios de conocimiento por departamento)
- **Estadísticas para administradores**: Endpoint de métricas de uso para el dashboard de administración

## 🏗️ Arquitectura

Este proyecto sigue **Clean Architecture** con 4 capas:

- **Presentation**: Controllers y DTOs (validación de entrada)
- **Application**: Use Cases (orquestación de lógica de negocio)
- **Domain**: Entidades, Value Objects, interfaces de repositorio y lógica de negocio pura
- **Infrastructure**: Implementación de repositorios, servicios externos (Pinecone, Auth0, Genkit)

📚 Ver [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) para la documentación completa de la arquitectura.

## 🚀 Stack Tecnológico

### Core

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Lenguaje** | TypeScript | 5.7 |
| **Runtime** | Node.js | 22+ |
| **Framework** | NestJS | 11 |
| **Package Manager** | pnpm | 10+ |

### Datos y AI

| Categoría | Tecnología | Detalles |
|-----------|-----------|---------|
| **Base de datos** | PostgreSQL | 16 (relacional) |
| **Vector Store** | Pinecone | Búsqueda semántica de embeddings |
| **ORM** | TypeORM | Migraciones y mapeo objeto-relacional |
| **LLM** | Google Genkit + Gemini 2.5 Flash (Vertex AI) | Chat y respuestas RAG |
| **Embeddings** | gemini-embedding-001 (Vertex AI) | Vectores de 3072 dimensiones |
| **Validación schemas** | Zod | Validación de entrada/salida del flujo RAG |

### Seguridad y Autenticación

| Categoría | Tecnología | Detalles |
|-----------|-----------|---------|
| **Autenticación** | Auth0 | OAuth2 + JWT (RS256 via JWKS) |
| **Autorización** | RBAC interno | Roles y permisos en BD |
| **Headers** | Helmet | Seguridad HTTP |
| **Rate Limiting** | @nestjs/throttler | Protección por endpoint |

### Calidad y DevOps

| Categoría | Tecnología | Detalles |
|-----------|-----------|---------|
| **Testing** | Jest | Unit, Integration, E2E (TDD) |
| **Linting** | ESLint 9 + SonarJS | Análisis estático de código |
| **Formato** | Prettier | Formato consistente |
| **Git Hooks** | Husky + lint-staged | Pre-commit y pre-push |
| **CI/CD** | GitHub Actions | Lint, test, build, security |
| **Seguridad deps** | Snyk + CodeQL | Escaneo de vulnerabilidades |
| **API Docs** | Swagger (OpenAPI) | Documentación interactiva |
| **Contenedores** | Docker + Docker Compose | Base de datos local |

### Librería Compartida

| Categoría | Tecnología | Detalles |
|-----------|-----------|---------|
| **Shared** | @context-ai-project/shared | Tipos e interfaces compartidas con el frontend (GitHub Packages) |

## 🌿 Branching Strategy

Este proyecto sigue una estrategia de branching por fases del MVP con ramas `main`, `develop` y `feature/*`.

📚 Ver [docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md) para detalles completos.

## 📋 Requisitos

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose
- PostgreSQL 16
- Cuenta de [Pinecone](https://www.pinecone.io/) (vector store para embeddings)
- Cuenta de [Auth0](https://auth0.com/) (autenticación OAuth2/JWT) — ver [docs/AUTH0_SETUP.md](./docs/AUTH0_SETUP.md)
- Proyecto de **Google Cloud Platform** con Vertex AI habilitado — autenticación via Application Default Credentials (ADC). En local ejecutar `gcloud auth application-default login`.
- Para que la API arranque sin error: **ElevenLabs** (TTS), **Shotstack** (vídeo), **GCS** (bucket y proyecto) y sus variables en `.env`. Ver [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md).

## 🛠️ Setup Local

### 1. Configurar acceso a GitHub Packages

Este proyecto usa el paquete `@context-ai-project/shared` publicado en [GitHub Packages](https://github.com/orgs/context-ai-project/packages). GitHub Packages requiere autenticación incluso para paquetes públicos.

1. Crea un **Personal Access Token (Classic)** en GitHub con el scope `read:packages`:
   - Ve a https://github.com/settings/tokens/new
   - Marca ✅ `read:packages`
   - Genera y copia el token

2. Añade la configuración a tu `~/.npmrc` global:

```bash
echo "//npm.pkg.github.com/:_authToken=ghp_TU_TOKEN_AQUI" >> ~/.npmrc
echo "@context-ai-project:registry=https://npm.pkg.github.com/" >> ~/.npmrc
```

> **Nota**: Esto se configura una sola vez por máquina.

### 2. Instalar dependencias

```bash
pnpm install
```

Al instalar se ejecuta el hook `prepare` (Husky) para configurar los Git hooks. Es normal; si el directorio aún no es un repositorio git, Husky puede mostrar un aviso sin bloquear la instalación.

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales (Auth0, Pinecone, GCP, INTERNAL_API_KEY y variables de Capsules)
```

**Importante:** La API carga el módulo de cápsulas (audio/vídeo) al arrancar. Para que el servidor inicie sin error debes rellenar también: `ELEVENLABS_API_KEY`, `GCS_BUCKET_CAPSULES`, `GCS_PROJECT_ID` y `SHOTSTACK_API_KEY`. Ver [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md).

### 4. Iniciar base de datos

```bash
docker compose up -d
```

Si el comando no existe (solo tienes el binario antiguo), usa `docker-compose up -d`. El contenedor usa el puerto `5433` (mapeado a `5432` interno) para evitar conflictos con instalaciones locales de PostgreSQL.

### 5. Verificar el setup

```bash
./scripts/verify-setup.sh
```

Este script verifica que Docker, PostgreSQL, el servidor y Swagger estén funcionando correctamente. **En Windows** no está disponible; comprueba manualmente: (1) `docker ps` y que el contenedor `context-ai-postgres` esté en ejecución, (2) puerto 5433 accesible, (3) que la API responda en `http://localhost:3001/api/v1` tras iniciar el servidor.

### 6. Desarrollo local del paquete compartido (opcional)

Si necesitas modificar `@context-ai-project/shared` y probar cambios localmente sin publicar una nueva versión:

```bash
# Clonar el repo shared (si aún no lo tienes)
git clone https://github.com/context-ai-project/context-ai-shared.git ../context-ai-shared

# Vincular localmente (sobreescribe la versión publicada)
cd context-ai-api
pnpm link ../context-ai-shared

# Cuando termines, restaurar la versión publicada
pnpm unlink @context-ai-project/shared
pnpm install
```

### 7. Ejecutar migraciones

```bash
pnpm migration:run
```

### 8. Sembrar datos de RBAC (Roles y Permisos)

⚠️ **IMPORTANTE**: Después de ejecutar las migraciones, debes sembrar los datos iniciales de RBAC:

```bash
# Primera vez o para actualizar roles/permisos
pnpm seed:rbac

# Para limpiar y re-sembrar (útil en desarrollo)
pnpm seed:rbac --clear
```

Este comando crea:
- 3 roles: `admin`, `manager`, `user`
- 14 permisos: chat, knowledge, profile, users, system, capsule (v2)
- Asignación de permisos a roles según nivel de acceso

**📋 Nota**: Este paso es **requerido** para que el sistema de autorización funcione correctamente. Sin él, los endpoints protegidos por RBAC pueden devolver 403 aunque el token Auth0 sea válido.

📚 Ver [docs/RBAC_SEEDING_STRATEGY.md](./docs/RBAC_SEEDING_STRATEGY.md) para detalles sobre la estrategia por environment.

### 9. Iniciar servidor en modo desarrollo

```bash
pnpm start:dev
```

El servidor estará disponible en `http://localhost:3001`

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

## 🪝 Git Hooks (Husky)

El proyecto utiliza Husky y lint-staged para garantizar la calidad del código con hooks de pre-commit y pre-push automáticos.

📚 Ver [docs/GIT_HOOKS.md](./docs/GIT_HOOKS.md) para configuración y detalles.

## 🔄 CI/CD con GitHub Actions

El proyecto tiene configurados workflows automáticos de CI (lint, test, build, security), CodeQL, Snyk y Release que se ejecutan en GitHub Actions.

📚 Ver [docs/CI_CD.md](./docs/CI_CD.md) para detalles de todos los workflows.

## 📚 Documentación API (Swagger)

**URL**: http://localhost:3001/api/docs — Documentación interactiva con exploración de endpoints, pruebas en vivo y autenticación JWT.

📚 Ver [docs/SWAGGER.md](./docs/SWAGGER.md) para la guía completa de Swagger.

## 🏗️ Estructura del Proyecto

```
src/
├── config/                    # Configuración centralizada
│   ├── app.config.ts          #   Configuración general de la app
│   ├── auth.config.ts         #   Configuración de Auth0
│   ├── database.config.ts     #   Configuración de PostgreSQL
│   ├── throttle.config.ts     #   Configuración de rate limiting
│   └── typeorm.config.ts      #   Configuración de TypeORM y migraciones
├── modules/
│   ├── audit/                 # 📊 Auditoría y logging de eventos
│   │   ├── domain/            #   Entidad AuditLog
│   │   ├── application/       #   AuditService
│   │   └── infrastructure/    #   Repositorio y modelo TypeORM
│   ├── auth/                  # 🔐 Autenticación (Auth0) + Autorización (RBAC)
│   │   ├── domain/            #   Entidades Role, Permission
│   │   ├── application/       #   PermissionService, TokenRevocation, RBACSeeder
│   │   ├── infrastructure/    #   Repositorios y modelos TypeORM
│   │   ├── guards/            #   JwtAuthGuard, RBACGuard, InternalApiKeyGuard
│   │   ├── decorators/        #   @CurrentUser, @Public, @RequirePermissions, @RequireRoles
│   │   ├── strategies/        #   JwtStrategy (JWKS validation)
│   │   └── types/             #   JwtPayload type
│   ├── knowledge/             # 📚 Gestión de conocimiento (Clean Architecture)
│   │   ├── domain/            #   Entidades, Value Objects, interfaces
│   │   ├── application/       #   Use Cases (IngestDocument, DeleteSource)
│   │   ├── infrastructure/    #   Repositorios, Pinecone, Chunking, Parser, Embeddings
│   │   └── presentation/      #   Controller y DTOs
│   ├── interaction/           # 💬 Chat RAG y conversaciones (Clean Architecture)
│   │   ├── domain/            #   Entidades (Conversation, Message), Value Objects
│   │   ├── application/       #   Use Case (QueryAssistant)
│   │   ├── infrastructure/    #   Repositorios y mappers
│   │   └── presentation/      #   Controller y DTOs
│   ├── users/                 # 👤 Gestión de usuarios
│   │   ├── domain/            #   Entidad User
│   │   ├── application/       #   UserService, AdminUserService
│   │   ├── infrastructure/    #   Repositorio y modelo TypeORM
│   │   └── api/               #   Controllers (users, admin)
│   ├── sectors/               # 📂 CRUD de sectores (activación/desactivación)
│   │   ├── domain/            #   Entidad Sector
│   │   ├── application/       #   Use Cases (Create, Update)
│   │   ├── infrastructure/    #   Repositorio y modelo TypeORM
│   │   └── presentation/      #   Controller y DTOs
│   ├── capsules/              # 🎙️ Cápsulas audio/vídeo (ElevenLabs, Shotstack, GCS, Imagen 3)
│   │   ├── domain/            #   Entidad Capsule, interfaces (IAudioGenerator, IVideoRenderer, etc.)
│   │   ├── application/       #   Use Cases (CRUD, GenerateScript, GenerateAudio, GenerateVideo), VideoPipelineService
│   │   ├── infrastructure/    #   ElevenLabs, GCS, Shotstack, Cloud Tasks, repositorio
│   │   └── presentation/      #   CapsulesController, InternalCapsulesController
│   ├── notifications/         # 🔔 Notificaciones in-app (event-driven)
│   │   ├── application/       #   NotificationService, listeners
│   │   ├── infrastructure/    #   Repositorio y modelo TypeORM
│   │   └── presentation/      #   NotificationController
│   ├── invitations/           # ✉️ Invitaciones de usuarios (Auth0 M2M, user tickets)
│   │   ├── domain/            #   Eventos de invitación
│   │   ├── application/       #   InvitationService
│   │   ├── infrastructure/    #   Repositorio, Auth0 Management
│   │   └── presentation/      #   InvitationController
│   └── stats/                 # 📊 Estadísticas para administradores
│       └── presentation/      #   StatsController, DTOs
├── shared/                    # 🔧 Código compartido
│   ├── genkit/                #   Configuración de Google Genkit (LLM + Embeddings)
│   │   └── flows/             #   RAG Query Flow
│   ├── prompts/               #   Servicio de plantillas de prompts
│   ├── constants/             #   Constantes (tokenización, etc.)
│   ├── types/                 #   Tipos compartidos y enums
│   ├── utils/                 #   Utilidades (manejo de errores)
│   ├── validators/            #   Validadores personalizados
│   ├── decorators/            #   Decoradores compartidos
│   ├── guards/                #   Guards compartidos
│   ├── interceptors/          #   Interceptores
│   └── filters/               #   Filtros de excepciones
├── migrations/                # 🗄️ Migraciones de base de datos (TypeORM)
├── scripts/                   # ⚙️ Scripts de utilidad (seed RBAC)
├── swagger.ts                 # 📄 Configuración de Swagger/OpenAPI
├── app.module.ts              # 🏠 Módulo raíz (imports, guards globales)
└── main.ts                    # 🚀 Entry point
```

> Cada módulo de negocio (`knowledge/`, `interaction/`, `capsules/`) sigue **Clean Architecture** con las 4 capas. Los módulos de soporte (`auth/`, `users/`, `audit/`, `sectors/`, `notifications/`, `invitations/`, `stats/`) siguen una estructura simplificada adaptada a sus necesidades.

## 🔐 Autenticación y Autorización

- **Autenticación**: Auth0 con OAuth2/JWT
- **Autorización**: Sistema interno de roles y permisos
- Los tokens de Auth0 se validan en cada request
- Los permisos se verifican contra la BD interna

## 📦 Dependencias Principales

### Producción

| Paquete | Propósito |
|---------|-----------|
| `@nestjs/core` + `@nestjs/common` | Framework NestJS |
| `@nestjs/typeorm` + `pg` | ORM y driver PostgreSQL |
| `@pinecone-database/pinecone` | SDK de Pinecone (vector store) |
| `genkit` + `@genkit-ai/ai` + `@genkit-ai/core` + `@genkit-ai/google-genai` | Google Genkit para LLM y embeddings (Vertex AI backend) |
| `@nestjs/passport` + `passport-jwt` + `jwks-rsa` | Autenticación JWT con JWKS (Auth0) |
| `@nestjs/throttler` | Rate limiting por endpoint |
| `@nestjs/swagger` | Documentación API (OpenAPI/Swagger) |
| `@nestjs/config` | Gestión de variables de entorno |
| `class-validator` + `class-transformer` | Validación y transformación de DTOs |
| `zod` | Validación de schemas (flujo RAG) |
| `pdf-parse` | Parsing de documentos PDF |
| `helmet` | Seguridad de headers HTTP |
| `@context-ai-project/shared` | Tipos compartidos con el frontend |

### Desarrollo

| Paquete | Propósito |
|---------|-----------|
| `jest` + `ts-jest` | Framework de testing |
| `supertest` | Testing HTTP (E2E) |
| `eslint` + `eslint-plugin-sonarjs` + `eslint-plugin-security` | Análisis estático |
| `prettier` | Formato de código |
| `husky` + `lint-staged` | Git hooks automáticos |
| `typescript` | Compilador TypeScript |

## 📚 Documentación Adicional

| Documento | Descripción |
|-----------|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Arquitectura completa del sistema |
| [AUTH0_SETUP.md](./docs/AUTH0_SETUP.md) | Guía de configuración de Auth0 |
| [BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md) | Estrategia de branching por fases |
| [CI_CD.md](./docs/CI_CD.md) | CI/CD con GitHub Actions (workflows y badges) |
| [DATABASE_SETUP.md](./docs/DATABASE_SETUP.md) | Setup de PostgreSQL y Pinecone |
| [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) | Variables de entorno requeridas |
| [GIT_HOOKS.md](./docs/GIT_HOOKS.md) | Git Hooks con Husky y lint-staged |
| [RATE_LIMITING.md](./docs/RATE_LIMITING.md) | Configuración de rate limiting |
| [RBAC_SEEDING_STRATEGY.md](./docs/RBAC_SEEDING_STRATEGY.md) | Estrategia de seeding de roles y permisos |
| [SECURITY_GUIDELINES.md](./docs/SECURITY_GUIDELINES.md) | Directrices de seguridad y OWASP |
| [SECURITY.md](./docs/SECURITY.md) | Política de seguridad del proyecto |
| [SNYK-SETUP.md](./docs/SNYK-SETUP.md) | Configuración de Snyk para seguridad |
| [SWAGGER.md](./docs/SWAGGER.md) | Guía de documentación de API (Swagger) |
| [TESTING_GUIDELINES.md](./docs/TESTING_GUIDELINES.md) | Estándares de testing (AAA, cobertura) |
| [TOKEN_REVOCATION.md](./docs/TOKEN_REVOCATION.md) | Sistema de revocación de tokens |

## 🚢 Deployment

Ver guía de deployment en la documentación del proyecto.

---

## 🤝 Contribución

Este proyecto es parte del TFM de la Maestría en IA.

Para más información, consulta la documentación en `/Context.ai/documentation/`.
