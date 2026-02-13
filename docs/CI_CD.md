# CI/CD con GitHub Actions - Context.ai API

El proyecto tiene configurados varios workflows automáticos que se ejecutan en GitHub Actions para garantizar la calidad, seguridad y correcta compilación del código.

---

## 📋 Overview

Todos los workflows se ejecutan en cada push y pull request a las ramas `main` y `develop`, asegurando que ningún código defectuoso llegue a producción.

---

## 🔄 CI Workflow (`ci.yml`)

Se ejecuta en cada push y pull request a `main` y `develop`:

### 1. **Lint Job**
- ✅ Ejecuta ESLint en todo el código
- ✅ Verifica el formato con Prettier
- ✅ Usa cache de pnpm para optimizar velocidad

### 2. **Test Job**
- ✅ Levanta PostgreSQL 16 como servicio
- ✅ Ejecuta todos los tests unitarios
- ✅ Genera reporte de cobertura
- ✅ Sube resultados a Codecov (opcional)
- ✅ Requiere cobertura mínima del 80%

### 3. **Build Job**
- ✅ Compila el proyecto TypeScript
- ✅ Verifica que el output `dist/` sea válido
- ✅ Solo se ejecuta si lint y tests pasan

### 4. **Security Job**
- ✅ Ejecuta `pnpm audit` para detectar vulnerabilidades
- ✅ Reporta dependencias con problemas de seguridad

---

## 🔍 CodeQL Workflow (`codeql.yml`)

Análisis de seguridad automático de GitHub:

- 🔍 Analiza el código en busca de vulnerabilidades
- 🔍 Se ejecuta en push, PR y semanalmente (lunes a las 00:00 UTC)
- 🔍 Usa queries extendidas de seguridad y calidad

---

## 🔒 Snyk Security Workflow (`snyk.yml`)

Escaneo de vulnerabilidades con Snyk:

### 1. **Snyk Test**
- 🔒 Escanea dependencias npm en busca de vulnerabilidades
- 🔒 Reporta solo severidades High y Critical
- 🔒 Sube resultados a GitHub Security tab
- 🔒 Se ejecuta en push, PR y diariamente

### 2. **Snyk Monitor**
- 📊 Monitorea el proyecto continuamente en Snyk dashboard
- 📊 Solo se ejecuta en push a main
- 📊 Envía alertas cuando aparecen nuevas vulnerabilidades

### 3. **Snyk Docker**
- 🐳 Escanea imágenes Docker (si existe Dockerfile)
- 🐳 Detecta vulnerabilidades en base image y layers

**Configuración detallada**: Ver [SNYK-SETUP.md](./SNYK-SETUP.md)

---

## 📦 Release Workflow (`release.yml`)

Se ejecuta cuando creas un tag (ej: `v1.0.0`):

- 📦 Ejecuta build y tests
- 📦 Genera changelog automático
- 📦 Crea un GitHub Release con notas

---

## 🏷️ Badges de Estado

Los badges en el README muestran el estado actual de:

- ✅ CI (tests, lint, build)
- ✅ CodeQL (análisis de seguridad estático)
- ✅ Snyk (escaneo de vulnerabilidades en dependencias)
- ✅ Versión de Node.js requerida
- ✅ Versión de TypeScript
- ✅ Licencia del proyecto

---

## 🛠️ Configuración Local

### Ejecutar validaciones manualmente

```bash
# Lint
pnpm lint

# Tests
pnpm test

# Build
pnpm build

# Todo junto (mismo que CI)
pnpm lint && pnpm build && pnpm test
```

### Verificar estado de workflows

Los resultados de los workflows están disponibles en:
- **GitHub Actions tab**: `https://github.com/{owner}/{repo}/actions`
- **PR checks**: En cada Pull Request, sección "Checks"
- **GitHub Security tab**: Para resultados de CodeQL y Snyk

---

## 📚 Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Snyk Documentation](https://docs.snyk.io/)

---

**Última actualización**: Phase 7 - Testing & Consolidation
**Maintained By**: Context.AI Development Team

