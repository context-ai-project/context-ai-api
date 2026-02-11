# RBAC Seeding Strategy

Esta guía describe la estrategia de inicialización de datos de RBAC (Roles y Permisos) para cada environment del proyecto Context.ai API.

## 📋 Tabla de Contenidos

- [Overview](#overview)
- [Arquitectura de Seeding](#arquitectura-de-seeding)
- [Estrategia por Environment](#estrategia-por-environment)
- [Datos Sembrados](#datos-sembrados)
- [Comandos Disponibles](#comandos-disponibles)
- [Casos de Uso](#casos-de-uso)
- [Troubleshooting](#troubleshooting)

---

## Overview

Context.ai utiliza un sistema de **RBAC (Role-Based Access Control)** con:
- **3 Roles**: `admin`, `manager`, `user`
- **10 Permisos**: organizados por recurso (chat, knowledge, profile, users, system)
- **Asignaciones**: Permisos asignados a roles según nivel de acceso

Estos datos son **críticos** para el funcionamiento del sistema de autorización.

---

## Arquitectura de Seeding

### Dos Mecanismos Complementarios

#### 1. **Migraciones SQL** (Primario)

**Ubicación**: `migrations/init/003_rbac_tables.sql`

**Características**:
- ✅ Se ejecuta con `pnpm migration:run`
- ✅ Idempotente: usa `ON CONFLICT DO NOTHING`
- ✅ Rápido y confiable
- ✅ Ideal para producción y CI/CD

```sql
-- Ejemplo de idempotencia
INSERT INTO roles (name, description, is_system_role) VALUES
  ('admin', 'Full system access and management capabilities', true),
  ('manager', 'Knowledge management and user oversight', true),
  ('user', 'Basic user access with read permissions', true)
ON CONFLICT (name) DO NOTHING;
```

#### 2. **Seeder Programático** (Secundario)

**Ubicación**: `src/modules/auth/application/services/rbac-seeder.service.ts`

**Características**:
- ✅ Ejecutable vía CLI: `pnpm seed:rbac`
- ✅ Idempotente: valida existencia antes de insertar
- ✅ Útil para desarrollo y testing
- ✅ Puede limpiar datos: `pnpm seed:rbac --clear`

```typescript
// Servicio NestJS exportable
await seederService.seed(); // Retorna estadísticas
```

---

## Estrategia por Environment

### 🏭 **Production**

**Método Recomendado**: Migraciones SQL

```bash
# Durante deployment
pnpm migration:run
```

**Ventajas**:
- ⚡ Más rápido (queries SQL directos)
- 🔒 Más seguro (transaccional)
- 📊 Traceable (migrations log)
- 🔄 Rollback sencillo

**Consideraciones**:
- Las migraciones se ejecutan **automáticamente** en el pipeline CI/CD
- No es necesario ejecutar el seeder programático
- Los datos de RBAC se tratan como **schema**, no como data

**Pipeline Ejemplo**:
```yaml
# .github/workflows/deploy.yml
- name: Run Migrations
  run: pnpm migration:run
  env:
    NODE_ENV: production
```

---

### 🧪 **Staging/QA**

**Método Recomendado**: Migraciones SQL + Seeder (opcional)

```bash
# 1. Migraciones (requerido)
pnpm migration:run

# 2. Seeder (opcional, si necesitas datos adicionales)
pnpm seed:rbac
```

**Ventajas**:
- Simula comportamiento de producción
- Permite validar el seeder antes de release
- Útil para testing de roles/permisos

**Consideraciones**:
- Staging debe ser lo más similar posible a producción
- El seeder es útil si necesitas resetear datos sin re-crear la DB

---

### 💻 **Development (Local)**

**Método Recomendado**: Seeder Programático

```bash
# Setup inicial
pnpm migration:run
pnpm seed:rbac

# Durante desarrollo (si cambias roles/permisos)
pnpm seed:rbac --clear  # Limpia y re-siembra
```

**Ventajas**:
- 🔄 Re-ejecución rápida
- 🧹 Fácil limpieza de datos
- 🐛 Útil para debugging
- 📝 Logs detallados

**Workflow Típico**:
```bash
# 1. Primera vez
docker-compose up -d
pnpm migration:run
pnpm seed:rbac

# 2. Después de cambios en roles/permisos
pnpm seed:rbac --clear
```

**Consideraciones**:
- Los desarrolladores **deben** ejecutar `pnpm seed:rbac` manualmente
- No se auto-ejecuta en `pnpm start:dev` para evitar overhead
- Agregado en la sección de "Setup Local" del README

---

### 🧬 **Testing (Automated)**

**Método Recomendado**: Seeder Programático en Tests

```typescript
// test/integration/auth/rbac.spec.ts
import { RbacSeederService } from '@modules/auth/application/services/rbac-seeder.service';

describe('RBAC Integration Tests', () => {
  let seeder: RbacSeederService;

  beforeAll(async () => {
    // Sembrar datos de RBAC
    await seeder.seed();
  });

  afterAll(async () => {
    // Limpiar datos de test
    await seeder.clear();
  });
});
```

**Ventajas**:
- 🧪 Control total sobre datos de test
- 🔄 Limpieza automática entre tests
- 🚀 No depende de migraciones
- 📊 Estadísticas de seeding

**Consideraciones**:
- Usar `clear()` con precaución (solo en tests)
- No ejecutar `clear()` en producción
- Los tests de integración deberían usar DB separada

---

### 🐳 **Docker/Containers**

**Método Recomendado**: Migraciones SQL

```dockerfile
# Dockerfile
FROM node:22-alpine

# ... build steps ...

# Las migraciones se ejecutan en entrypoint
CMD ["sh", "-c", "pnpm migration:run && pnpm start:prod"]
```

**docker-compose.yml Ejemplo**:
```yaml
services:
  api:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
    command: sh -c "pnpm migration:run && pnpm start:prod"
```

**Consideraciones**:
- Las migraciones deben ejecutarse **antes** de iniciar la app
- Usar `depends_on` con `condition: service_healthy`
- Evitar auto-ejecutar seeders en containers de producción

---

## Datos Sembrados

### Roles

| Nombre | Descripción | Permisos |
|--------|-------------|----------|
| `admin` | Administrador del sistema | **Todos** (10 permisos) |
| `manager` | Gestor de conocimiento | 8 permisos (sin `users:manage`, `system:admin`) |
| `user` | Usuario estándar | 4 permisos básicos |

### Permisos

#### Chat
- `chat:read` - Interactuar con el asistente IA

#### Knowledge
- `knowledge:read` - Ver documentos de conocimiento
- `knowledge:create` - Subir y crear documentos
- `knowledge:update` - Editar documentos
- `knowledge:delete` - Eliminar documentos

#### Profile
- `profile:read` - Ver perfil propio
- `profile:update` - Actualizar perfil propio

#### Users
- `users:read` - Ver información de usuarios
- `users:manage` - Gestionar usuarios (crear, actualizar, eliminar)

#### System
- `system:admin` - Acceso administrativo completo al sistema

### Asignación de Permisos

```
USER ROLE:
├── chat:read
├── knowledge:read
├── profile:read
└── profile:update

MANAGER ROLE (hereda USER + adicionales):
├── chat:read
├── knowledge:read
├── knowledge:create
├── knowledge:update
├── knowledge:delete
├── profile:read
├── profile:update
└── users:read

ADMIN ROLE (todos):
├── chat:read
├── knowledge:read
├── knowledge:create
├── knowledge:update
├── knowledge:delete
├── profile:read
├── profile:update
├── users:read
├── users:manage
└── system:admin
```

---

## Comandos Disponibles

### CLI Scripts

```bash
# Sembrar datos de RBAC (idempotente)
pnpm seed:rbac

# Limpiar y re-sembrar (⚠️ solo desarrollo/testing)
pnpm seed:rbac --clear
```

### Programático (desde código)

```typescript
import { RbacSeederService } from '@modules/auth/application/services/rbac-seeder.service';

// Sembrar datos
const result = await seederService.seed();
console.log(`Roles creados: ${result.rolesCreated}`);
console.log(`Permisos creados: ${result.permissionsCreated}`);
console.log(`Asociaciones creadas: ${result.associationsCreated}`);

// Limpiar datos (⚠️ solo testing)
await seederService.clear();
```

### Migraciones

```bash
# Ejecutar todas las migraciones (incluye RBAC)
pnpm migration:run

# Ver estado de migraciones
pnpm migration:show

# Revertir última migración
pnpm migration:revert
```

---

## Casos de Uso

### Caso 1: Setup Inicial en Desarrollo

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd context-ai-api

# 2. Instalar dependencias
pnpm install

# 3. Configurar environment
cp .env.example .env
# Editar .env con tus credenciales

# 4. Levantar base de datos
docker-compose up -d

# 5. Ejecutar migraciones
pnpm migration:run

# 6. Sembrar datos de RBAC ⭐
pnpm seed:rbac

# 7. Iniciar servidor
pnpm start:dev
```

---

### Caso 2: Actualizar Roles/Permisos en Desarrollo

```bash
# Opción A: Re-ejecutar seeder (mantiene datos existentes)
pnpm seed:rbac

# Opción B: Limpiar y re-sembrar (resetea todo)
pnpm seed:rbac --clear
```

---

### Caso 3: Deployment a Producción

```bash
# En CI/CD pipeline
pnpm install --frozen-lockfile
pnpm build
pnpm migration:run  # Incluye RBAC seeding
pnpm start:prod
```

**No es necesario** ejecutar `pnpm seed:rbac` porque las migraciones ya incluyen los datos.

---

### Caso 4: Testing de Integración

```typescript
// test/integration/setup.ts
import { Test } from '@nestjs/testing';
import { RbacSeederService } from '@modules/auth/application/services/rbac-seeder.service';

export async function setupTestDatabase() {
  // 1. Crear módulo de testing
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule, TypeOrmModule.forRoot(testConfig)],
  }).compile();

  // 2. Obtener seeder
  const seeder = moduleRef.get(RbacSeederService);

  // 3. Sembrar datos
  await seeder.seed();

  return { moduleRef, seeder };
}

export async function teardownTestDatabase(seeder: RbacSeederService) {
  // Limpiar datos de test
  await seeder.clear();
}
```

```typescript
// test/integration/auth/rbac.spec.ts
describe('RBAC Authorization', () => {
  let seeder: RbacSeederService;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    seeder = setup.seeder;
  });

  afterAll(async () => {
    await teardownTestDatabase(seeder);
  });

  it('should restrict user role from creating knowledge', async () => {
    // Test logic here
  });
});
```

---

### Caso 5: Debugging de Permisos

```bash
# Ver logs detallados del seeder
pnpm seed:rbac

# Output esperado:
# [RbacSeederService] Starting RBAC seeding...
# [RbacSeederService] Created role: admin
# [RbacSeederService] Created role: manager
# [RbacSeederService] Created role: user
# [RbacSeederService] Created permission: chat:read
# [RbacSeederService] Created permission: knowledge:read
# ...
# [RbacSeederService] Assigned 10 permissions to role: admin
# [RbacSeederService] Assigned 8 permissions to role: manager
# [RbacSeederService] Assigned 4 permissions to role: user
# [RbacSeederService] RBAC seeding completed: 3 roles, 10 permissions, 22 associations
```

---

## Troubleshooting

### ❌ Error: "Role not found"

**Causa**: Los datos de RBAC no fueron sembrados.

**Solución**:
```bash
# Verificar si las migraciones corrieron
pnpm migration:show

# Si no, ejecutar migraciones
pnpm migration:run

# O ejecutar seeder manualmente
pnpm seed:rbac
```

---

### ❌ Error: "Permission denied"

**Causa**: El rol del usuario no tiene el permiso requerido.

**Solución**:
```bash
# 1. Verificar asignación de permisos en DB
psql -U postgres -d contextai
SELECT r.name as role, p.name as permission
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
ORDER BY r.name, p.name;

# 2. Re-sembrar si faltan permisos
pnpm seed:rbac --clear
```

---

### ❌ Error: "Seeder tarda mucho"

**Causa**: El seeder es idempotente y valida cada rol/permiso antes de insertar.

**Solución**:
```bash
# En producción, usa migraciones (más rápidas)
pnpm migration:run

# En desarrollo, limpia y re-siembra
pnpm seed:rbac --clear
```

---

### ❌ Error: "Database connection failed"

**Causa**: PostgreSQL no está corriendo o las credenciales son incorrectas.

**Solución**:
```bash
# 1. Verificar que Docker está corriendo
docker ps | grep postgres

# 2. Si no, levantar base de datos
docker-compose up -d

# 3. Verificar credenciales en .env
cat .env | grep DB_
```

---

### 🔍 Verificar Estado de RBAC

```sql
-- Conectar a la base de datos
psql -U postgres -d contextai

-- Ver roles
SELECT * FROM roles ORDER BY name;

-- Ver permisos
SELECT * FROM permissions ORDER BY name;

-- Ver asignaciones completas
SELECT 
  r.name as role,
  COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.name;

-- Debería mostrar:
-- admin:    10 permisos
-- manager:  8 permisos
-- user:     4 permisos
```

---

## Resumen de Estrategia

| Environment | Método Primario | Método Secundario | Auto-ejecutar |
|-------------|----------------|-------------------|---------------|
| **Production** | ✅ Migraciones SQL | ❌ N/A | ✅ Sí (en pipeline) |
| **Staging** | ✅ Migraciones SQL | 🟡 Seeder (opcional) | ✅ Sí (en pipeline) |
| **Development** | 🟡 Migraciones SQL | ✅ Seeder Programático | ❌ No (manual) |
| **Testing** | ❌ N/A | ✅ Seeder Programático | ✅ Sí (en tests) |
| **Docker** | ✅ Migraciones SQL | ❌ N/A | ✅ Sí (en entrypoint) |

---

## Referencias

- [Migraciones SQL](../migrations/init/003_rbac_tables.sql) - Definición completa de schema y datos
- [RbacSeederService](../src/modules/auth/application/services/rbac-seeder.service.ts) - Implementación del seeder
- [CLI Script](../src/scripts/seed-rbac.ts) - Script de línea de comandos
- [SECURITY_GUIDELINES.md](./SECURITY_GUIDELINES.md) - Buenas prácticas de seguridad
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitectura general del proyecto

---

**Última actualización**: Febrero 2026  
**Versión**: 1.0.0  
**Autor**: Context.ai Team

