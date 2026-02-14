# Branching Strategy - Context.ai

## 📋 Overview

Este documento define la estrategia de branching para el desarrollo del MVP de Context.ai.

---

## 🌿 Branch Nomenclature

### Main Branches

- **`main`**: Branch principal, código en producción
  - Siempre debe estar deployable
  - Protegido, requiere Pull Request con reviews
  - CI/CD corre automáticamente
  - Tags para releases (v1.0.0, v1.1.0, etc.)

- **`develop`**: Branch de integración continua
  - Si se usa, todas las features se mergean aquí primero
  - Periódicamente se mergea a `main`

### Feature Branches (Por Fase del MVP)

Nomenclatura: `feature/phase-{número}-{descripción-corta}`

#### Fases del MVP

```
✅ main (Fase 1-2 completadas)
├── feature/phase-3-knowledge-context       ← Backend: Knowledge Module
├── feature/phase-4-interaction-context     ← Backend: RAG + Chat
├── feature/phase-5-chat-interface          ← Frontend: UI de Chat
├── feature/phase-6-auth-authorization      ← Backend + Frontend: Auth0 + RBAC
├── feature/phase-6b-pinecone-migration     ← Backend: Migración a Pinecone
├── feature/phase-7-testing-consolidation   ← Tests + Consolidación
└── feature/phase-8-deployment              ← Deployment + Docker
```

---

## 🔄 Workflow

### 1. Crear Feature Branch

```bash
# Asegurarse de estar en main actualizado
git checkout main
git pull origin main

# Crear nuevo branch para la fase
git checkout -b feature/phase-3-knowledge-context
```

### 2. Desarrollar con TDD

```bash
# Hacer commits frecuentes y atómicos
git add .
git commit -m "test: add KnowledgeSource entity tests (Red phase)"
git commit -m "feat: implement KnowledgeSource entity (Green phase)"
git commit -m "refactor: improve KnowledgeSource validation (Refactor phase)"
```

### 3. Push y Pull Request

```bash
# Push del branch
git push origin feature/phase-3-knowledge-context

# Crear Pull Request en GitHub
# Título: "Feature: Phase 3 - Knowledge Context Module"
# Descripción: Usar template de PR
```

### 4. Review y Merge

- PR requiere:
  - ✅ CI/CD passing (tests, lint, build)
  - ✅ Code coverage ≥ 80%
  - ✅ Snyk security check passing
  - ✅ CodeQL analysis passing
  - ✅ (Opcional) Code review aprobado

- Merge strategy: **Squash and merge** para mantener historial limpio

### 5. Post-merge

```bash
# Después del merge, actualizar main local
git checkout main
git pull origin main
```

> ⚠️ **IMPORTANTE**: No eliminar feature branches después del merge. Todas las ramas `feature/*` deben preservarse para la validación y evaluación del proyecto final del Máster.

---

## 📝 Commit Message Convention

Seguimos **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: Nueva funcionalidad
- **fix**: Bug fix
- **test**: Añadir o modificar tests
- **refactor**: Refactorización sin cambio de funcionalidad
- **docs**: Documentación
- **style**: Cambios de formato (prettier, eslint)
- **perf**: Mejoras de performance
- **chore**: Cambios en build, CI/CD, dependencies

### Examples

```bash
# TDD Red Phase
git commit -m "test: add DocumentParserService unit tests

- Test parsing PDF files
- Test parsing Markdown files
- Test error handling for invalid formats

Related to #23"

# TDD Green Phase
git commit -m "feat(knowledge): implement DocumentParserService

- Parse PDF with pdf-parse library
- Parse Markdown with marked library
- Handle errors gracefully

Tests: All passing
Coverage: 92%"

# TDD Refactor Phase
git commit -m "refactor(knowledge): extract PDF parsing to separate method

- Improve code readability
- Reduce cyclomatic complexity
- No functionality changes

Tests: All still passing"
```

---

## 🔐 Branch Protection Rules

### `main` branch

Configurar en GitHub:

- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - CI/CD workflow
  - CodeQL analysis
  - Snyk security
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ✅ Require linear history (squash merges)

---

## 🚀 Release Strategy

### Tagging

Cuando una fase completa se mergea a `main`:

```bash
git checkout main
git pull origin main
git tag -a v0.3.0 -m "Release: Phase 3 - Knowledge Context Module"
git push origin v0.3.0
```

### Version Numbering

- **v0.x.x**: MVP phases (pre-production)
- **v1.0.0**: MVP completo y deployado
- **v1.x.x**: Post-MVP features

---

## 📊 Example Git History

```
* feat(knowledge): add IngestDocumentUseCase (Phase 3)
* test(knowledge): add EmbeddingService tests (Phase 3)
* refactor(knowledge): improve chunking algorithm (Phase 3)
|
* Merge pull request #15 from feature/phase-3-knowledge-context
|
* chore: configure Snyk security scanning (Phase 2)
* feat: add Swagger documentation (Phase 2)
* feat: setup NestJS project structure (Phase 2)
```

---

## 🎯 Benefits

1. **Clarity**: Fácil identificar qué fase se está trabajando
2. **Isolation**: Cada fase tiene su propio branch
3. **Review**: PRs facilitan code review y discusión
4. **CI/CD**: Validación automática antes de merge
5. **Rollback**: Fácil revertir una fase completa si es necesario
6. **History**: Historial limpio y entendible

---

## 📚 References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)

---

**Última actualización**: 2026-02-05

