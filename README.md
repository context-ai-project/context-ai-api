# Context.ai API

[![CI](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/ci.yml/badge.svg)](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/ci.yml)
[![CodeQL](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/codeql.yml/badge.svg)](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/codeql.yml)
[![Snyk Security](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/snyk.yml/badge.svg)](https://github.com/gromeroalfonso/context-ai-api/actions/workflows/snyk.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Backend API para el sistema RAG de Context.ai.

## 🏗️ Arquitectura

Este proyecto sigue **Clean Architecture** con 4 capas:

- **Presentation**: Controllers y DTOs
- **Application**: Use Cases y lógica de aplicación
- **Domain**: Entidades, Value Objects y lógica de negocio
- **Infrastructure**: Implementación de repositorios, servicios externos

## 🌿 Branching Strategy

Este proyecto sigue una estrategia de branching por fases del MVP:

- `main` - Branch principal (protegido, requiere PR)
- `feature/phase-3-knowledge-context` - 🚧 **En desarrollo**
- `feature/phase-4-rag-interaction` - Próximo
- `feature/phase-6-auth-authorization` - Próximo
- `feature/phase-7-testing-validation` - Próximo

Ver [docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md) para más detalles.

## 🚀 Tecnologías

- **Framework**: NestJS 11
- **Database**: PostgreSQL 16 + pgvector
- **ORM**: TypeORM
- **IA**: Google Genkit + Gemini 1.5 Pro
- **Auth**: Auth0 (OAuth2 + JWT)
- **Testing**: Jest (TDD)
- **Validation**: class-validator

## 📋 Requisitos

- Node.js 22+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16 con extensión pgvector

## 🛠️ Setup Local

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 3. Iniciar base de datos

```bash
docker-compose up -d
```

**Nota**: El contenedor usa el puerto `5433` (mapeado a `5432` interno) para evitar conflictos con instalaciones locales de PostgreSQL.

### 4. Verificar el setup

```bash
./scripts/verify-setup.sh
```

Este script verifica que Docker, PostgreSQL, el servidor y Swagger estén funcionando correctamente.

### 5. Vincular paquete compartido (desarrollo local)

```bash
# En context-ai-shared
cd ../context-ai-shared
pnpm link --global

# En context-ai-api
pnpm link --global @context-ai/shared
```

### 6. Ejecutar migraciones

```bash
pnpm migration:run
```

### 7. Sembrar datos de RBAC (Roles y Permisos)

⚠️ **IMPORTANTE**: Después de ejecutar las migraciones, debes sembrar los datos iniciales de RBAC:

```bash
# Primera vez o para actualizar roles/permisos
pnpm seed:rbac

# Para limpiar y re-sembrar (útil en desarrollo)
pnpm seed:rbac --clear
```

Este comando crea:
- 3 roles: `admin`, `manager`, `user`
- 10 permisos: chat, knowledge, profile, users, system
- Asignación de permisos a roles según nivel de acceso

**📋 Nota**: Este paso es **requerido** para que el sistema de autorización funcione correctamente.

📚 Ver [docs/RBAC_SEEDING_STRATEGY.md](./docs/RBAC_SEEDING_STRATEGY.md) para detalles sobre la estrategia por environment.

### 8. Iniciar servidor en modo desarrollo

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

El proyecto utiliza Husky para garantizar la calidad del código antes de hacer commits y pushes:

### Pre-commit Hook
- ✅ **Ejecuta lint-staged** en archivos modificados
- ✅ **Corrige automáticamente** errores de formato
- ✅ **Bloquea el commit** si hay errores de ESLint

### Pre-push Hook
- ✅ **Ejecuta todos los tests** unitarios
- ✅ **Ejecuta el linter** en todo el código
- ✅ **Bloquea el push** si algún test falla

### Configuración

Los hooks se instalan automáticamente al ejecutar `pnpm install` gracias al script `prepare`.

```bash
# Saltar hooks temporalmente (no recomendado)
git commit --no-verify -m "mensaje"
git push --no-verify
```

## 🔄 CI/CD con GitHub Actions

El proyecto tiene configurados varios workflows automáticos que se ejecutan en GitHub Actions:

### **CI Workflow** (`ci.yml`)

Se ejecuta en cada push y pull request a `main` y `develop`:

#### 1. **Lint Job**
- ✅ Ejecuta ESLint en todo el código
- ✅ Verifica el formato con Prettier
- ✅ Usa cache de pnpm para optimizar velocidad

#### 2. **Test Job**
- ✅ Levanta PostgreSQL 16 + pgvector como servicio
- ✅ Ejecuta todos los tests unitarios
- ✅ Genera reporte de cobertura
- ✅ Sube resultados a Codecov (opcional)
- ✅ Requiere cobertura mínima del 80%

#### 3. **Build Job**
- ✅ Compila el proyecto TypeScript
- ✅ Verifica que el output `dist/` sea válido
- ✅ Solo se ejecuta si lint y tests pasan

#### 4. **Security Job**
- ✅ Ejecuta `pnpm audit` para detectar vulnerabilidades
- ✅ Reporta dependencias con problemas de seguridad

### **CodeQL Workflow** (`codeql.yml`)

Análisis de seguridad automático de GitHub:
- 🔍 Analiza el código en busca de vulnerabilidades
- 🔍 Se ejecuta en push, PR y semanalmente (lunes a las 00:00 UTC)
- 🔍 Usa queries extendidas de seguridad y calidad

### **Snyk Security Workflow** (`snyk.yml`)

Escaneo de vulnerabilidades con Snyk:

#### 1. **Snyk Test**
- 🔒 Escanea dependencias npm en busca de vulnerabilidades
- 🔒 Reporta solo severidades High y Critical
- 🔒 Sube resultados a GitHub Security tab
- 🔒 Se ejecuta en push, PR y diariamente

#### 2. **Snyk Monitor**
- 📊 Monitorea el proyecto continuamente en Snyk dashboard
- 📊 Solo se ejecuta en push a main
- 📊 Envía alertas cuando aparecen nuevas vulnerabilidades

#### 3. **Snyk Docker**
- 🐳 Escanea imágenes Docker (si existe Dockerfile)
- 🐳 Detecta vulnerabilidades en base image y layers

**Configuración**: Ver [docs/SNYK-SETUP.md](./docs/SNYK-SETUP.md) para instrucciones detalladas

### **Release Workflow** (`release.yml`)

Se ejecuta cuando creas un tag (ej: `v1.0.0`):
- 📦 Ejecuta build y tests
- 📦 Genera changelog automático
- 📦 Crea un GitHub Release con notas

### **Cómo Crear un Release**

```bash
# Crear tag localmente
git tag -a v1.0.0 -m "Release v1.0.0"

# Empujar tag a GitHub (esto dispara el workflow)
git push origin v1.0.0
```

### **Badges de Estado**

Los badges en el README muestran el estado actual de:
- ✅ CI (tests, lint, build)
- ✅ CodeQL (análisis de seguridad estático)
- ✅ Snyk (escaneo de vulnerabilidades en dependencias)
- ✅ Versión de Node.js requerida
- ✅ Versión de TypeScript
- ✅ Licencia del proyecto

## 📚 Documentación API

### Swagger UI

**URL**: http://localhost:3001/api/docs

La documentación interactiva de la API está disponible a través de Swagger UI, que incluye:

- ✅ **Exploración completa** de todos los endpoints
- ✅ **Pruebas en vivo** directamente desde el navegador
- ✅ **Autenticación JWT** con Auth0
- ✅ **Schemas de DTOs** con validaciones
- ✅ **Respuestas de ejemplo** para cada endpoint
- ✅ **Filtros y búsqueda** de endpoints
- ✅ **Persistencia de autorización** entre recargas

### Tags Organizados

- `auth` - Autenticación y gestión de usuarios
- `knowledge` - Gestión de fuentes de conocimiento y documentos
- `interaction` - Chat y consultas RAG
- `authorization` - Gestión de roles y permisos

📚 **[Ver guía completa de Swagger](./docs/SWAGGER.md)** - Aprende a documentar endpoints correctamente

## 🏗️ Estructura del Proyecto

```
src/
├── config/                 # Configuración (database, auth, etc.)
├── modules/
│   ├── auth/              # Autenticación (Auth0)
│   ├── authorization/     # Autorización interna (RBAC)
│   ├── knowledge/         # Context: Gestión de conocimiento
│   │   ├── domain/        # Entidades y lógica de negocio
│   │   ├── application/   # Use cases
│   │   ├── infrastructure/# Repositorios, servicios
│   │   └── presentation/  # Controllers
│   └── interaction/       # Context: Chat y RAG
├── shared/                # Código compartido
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   └── genkit/           # Configuración de Genkit
└── main.ts
```

## 🔐 Autenticación y Autorización

- **Autenticación**: Auth0 con OAuth2/JWT
- **Autorización**: Sistema interno de roles y permisos
- Los tokens de Auth0 se validan en cada request
- Los permisos se verifican contra la BD interna

## 📦 Dependencias Principales

- `@nestjs/typeorm` - ORM integration
- `pg` + `pgvector` - PostgreSQL con soporte vectorial
- `@nestjs/passport` + `passport-jwt` - Autenticación JWT
- `class-validator` - Validación de DTOs
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting

## 🚢 Deployment

Ver guía de deployment en la documentación del proyecto.

## 📄 Licencia

MIT
