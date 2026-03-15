# Security Guidelines

This document outlines security practices, OWASP Top 10 compliance, and the complete authentication & authorization architecture for Context.AI API.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Authentication (Phase 6)](#authentication-phase-6)
- [Authorization (Phase 6)](#authorization-phase-6)
- [Token Revocation](#token-revocation)
- [Rate Limiting](#rate-limiting)
- [Audit Logging](#audit-logging)
- [OWASP Top 10 Compliance](#owasp-top-10-compliance)
- [Input Validation](#input-validation)
- [Object Injection Prevention](#object-injection-prevention)
- [Environment Variables](#environment-variables)
- [Error Handling](#error-handling)
- [Security Testing](#security-testing)
- [Security Checklist](#security-checklist)

---

## 🏗️ Architecture Overview

Context.AI implements a multi-layered security architecture:

```
Request → Rate Limiter → JWT Auth → RBAC Guard → Controller → Response
              │               │           │              │
         ThrottlerGuard   JwtAuthGuard  RBACGuard    @CurrentUser
              │               │           │
         429 Too Many    401 Unauth   403 Forbidden
```

### Security Layers (in execution order)

| Layer | Guard | Purpose |
|-------|-------|---------|
| 1. Rate Limiting | `ThrottlerGuard` | DDoS protection, fair usage |
| 2. Authentication | `JwtAuthGuard` | JWT validation via Auth0 JWKS |
| 3. Authorization | `RBACGuard` | Permission & role-based access |
| 4. Audit | `AuditService` | Security event logging |

### Key Technologies

| Component | Technology |
|-----------|-----------|
| Identity Provider | Auth0 |
| Token Format | JWT (RS256, asymmetric) |
| Key Validation | JWKS (JSON Web Key Set) |
| Rate Limiting | @nestjs/throttler |
| Authorization | Custom RBAC (roles + permissions) |
| Audit Trail | PostgreSQL audit_logs table |

---

## 🔐 Authentication (Phase 6)

### JWT Strategy with JWKS

Authentication uses Auth0-issued JWT tokens validated with JWKS (public key rotation):

```typescript
// Flow: Client → Auth0 → JWT → API → JWKS validation
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
      }),
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ['RS256'], // Asymmetric only (no shared secret)
    });
  }
}
```

**Security Properties**:
- ✅ **RS256**: Asymmetric keys (API never holds the signing key)
- ✅ **JWKS**: Automatic key rotation from Auth0
- ✅ **Audience validation**: Tokens must be intended for our API
- ✅ **Issuer validation**: Tokens must come from our Auth0 tenant
- ✅ **Expiration enforcement**: Expired tokens are automatically rejected

### JwtAuthGuard

The `JwtAuthGuard` extends `AuthGuard('jwt')` and adds:

1. **Public route bypass**: Routes decorated with `@Public()` skip authentication
2. **Token revocation check**: After JWT validation, checks if the token JTI has been revoked
3. **Detailed error messages**: Different responses for expired, invalid, and revoked tokens
4. **Security logging**: All failed authentication attempts are logged

```typescript
// Usage: Applied globally via APP_GUARD in AppModule
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  @Public() // Skips authentication
  @Get('health')
  health() { return { status: 'ok' }; }

  @Get('sources') // Requires valid JWT
  getSources(@CurrentUser() user: ValidatedUser) {
    return this.service.findByUser(user.userId);
  }
}
```

### User Sync on First Login

When a user authenticates for the first time, the JwtStrategy:
1. Validates the JWT token via JWKS
2. Extracts the Auth0 `sub` claim (user ID)
3. Looks up or creates the user in our database via `UserService.syncUser()`
4. Attaches the `ValidatedUser` object to `req.user`

---

## 🛡️ Authorization (Phase 6)

### RBAC Model

Context.AI uses a three-tier RBAC model:

```
Users ──M:N──▸ Roles ──M:N──▸ Permissions
```

**Default Roles**:

| Role | Permissions | Description |
|------|------------|-------------|
| `user` | `chat:read`, `knowledge:read`, `profile:read`, `profile:update` | Default for all users (4 permissions) |
| `manager` | user + `knowledge:create`, `knowledge:update`, `knowledge:delete`, `users:read` | Content managers (8 permissions) |
| `admin` | All permissions (includes `users:manage`, `system:admin`) | Full system access (10 permissions) |

### Permission Decorators

```typescript
// Require specific permissions (AND logic — default)
@RequirePermissions(['knowledge:read', 'knowledge:update'])
@Get('sources')
getSources() { ... }

// Require ANY permission (OR logic)
@RequirePermissions(['knowledge:read', 'chat:read'], { mode: PermissionMatchMode.ANY })
@Get('data')
getData() { ... }

// Require specific roles (OR logic — user needs at least one)
@RequireRoles('admin', 'manager')
@Delete('users/:id')
deleteUser() { ... }

// Combined (both role AND permission required)
@RequirePermissions(['users:manage'])
@RequireRoles('admin')
@Delete('danger-zone')
dangerZone() { ... }
```

### RBACGuard

The `RBACGuard` reads metadata from decorators and validates:
1. **Roles**: Checks if user has at least one required role (OR logic)
2. **Permissions**: Checks if user has required permissions (AND/OR configurable)
3. **Fail-secure**: Returns 403 if user is missing or has no userId
4. **Structured logging**: All access decisions are logged for audit

---

## 🔄 Token Revocation

See [TOKEN_REVOCATION.md](TOKEN_REVOCATION.md) for full details.

**Summary**:
- In-memory `Map<jti, expirationMs>` for O(1) lookup
- Automatic cleanup of expired entries every 10 minutes
- Integrated into `JwtAuthGuard.handleRequest()` after JWT validation
- Supports immediate logout and compromised token invalidation

```typescript
// Revoke a token (logout)
tokenRevocationService.revokeToken(jti, exp);

// Check in JwtAuthGuard
if (tokenRevocationService.isTokenRevoked(user.jti)) {
  throw new UnauthorizedException('Token has been revoked');
}
```

---

## ⏱️ Rate Limiting

See [RATE_LIMITING.md](RATE_LIMITING.md) for full details.

**Summary**: Three-tier rate limiting with `@nestjs/throttler`:

| Tier | TTL | Limit | Purpose |
|------|-----|-------|---------|
| Short | 1s | 10 req | Burst protection |
| Medium | 60s | 100 req | Sustained abuse |
| Long | 3600s | 1000 req | Hourly cap |

Per-endpoint overrides in InteractionController:

| Endpoint | Limit | TTL |
|----------|-------|-----|
| `POST /interaction/query` | 30 req | 60s |
| `GET /interaction/conversations` | 50 req | 60s |
| `GET /interaction/conversations/:id` | 60 req | 60s |
| `DELETE /interaction/conversations/:id` | 20 req | 60s |

---

## 📝 Audit Logging

**13 Security Event Types** (defined in `AuditEventType` enum):

| Event | When |
|-------|------|
| `LOGIN` | Successful authentication |
| `LOGOUT` | User-initiated logout |
| `LOGIN_FAILED` | Failed authentication |
| `ROLE_CHANGED` | Admin changes user role |
| `PERMISSION_CHANGED` | Permission modification |
| `ACCESS_DENIED` | 403 Forbidden |
| `TOKEN_REVOKED` | Token blacklisted |
| `RATE_LIMIT_EXCEEDED` | 429 Too Many Requests |
| `SENSITIVE_DATA_ACCESS` | Sensitive data accessed |
| `DATA_EXPORT` | Data exported |
| `USER_CREATED` | New user account created |
| `USER_DELETED` | User account deleted |
| `USER_SUSPENDED` | User account suspended |

**Features**:
- Append-only table (no updates/deletes)
- IP masking for privacy (`192.168.1.100` → `192.168.1.***`)
- JSONB metadata for flexible event data
- Composite indexes for efficient querying
- Retention cleanup support

---

## 🔒 OWASP Top 10 Compliance

### A01:2021 — Broken Access Control ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| JWT Authentication | `JwtAuthGuard` + Auth0 JWKS | ✅ |
| RBAC | `RBACGuard` + `@RequirePermissions` | ✅ |
| Route protection | Global `APP_GUARD` | ✅ |
| @Public bypass | Explicit opt-out only | ✅ |
| Ownership checks | UserID from JWT, not URL | ✅ |

### A02:2021 — Cryptographic Failures ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| RS256 asymmetric keys | Auth0 JWKS (no shared secret) | ✅ |
| HTTPS in production | Enforced via environment | ✅ |
| No sensitive data in tokens | Only sub, email, permissions | ✅ |
| Secrets in env vars | ConfigService + validation | ✅ |

### A03:2021 — Injection ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| SQL injection | TypeORM parameterized queries | ✅ |
| DTO validation | class-validator on all inputs | ✅ |
| ReDoS prevention | Bounded regex quantifiers | ✅ |
| Object injection | eslint-plugin-security | ✅ |

### A04:2021 — Insecure Design ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| Clean Architecture | Domain/Application/Infrastructure layers | ✅ |
| Defense in depth | Multi-layer guard pipeline | ✅ |
| Fail-secure defaults | 401/403 on missing auth | ✅ |
| Principle of least privilege | Default role = minimal permissions | ✅ |

### A05:2021 — Security Misconfiguration ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| CORS configuration | Explicit allowed origins | ✅ |
| Security headers | Helmet middleware | ✅ |
| Environment validation | Required env vars checked at startup | ✅ |
| No default credentials | Auth0 manages credentials | ✅ |

### A06:2021 — Vulnerable Components ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| Dependency scanning | Snyk + pnpm audit | ✅ |
| CodeQL analysis | GitHub Actions workflow | ✅ |
| eslint-plugin-security | Static security analysis | ✅ |
| Regular updates | Dependabot configured | ✅ |

### A07:2021 — Auth Failures ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| Rate limiting | 3-tier throttler | ✅ |
| Token revocation | Immediate logout capability | ✅ |
| Brute force protection | Short-term rate limit (10/s) | ✅ |
| Audit logging | All auth events logged | ✅ |

### A08:2021 — Software Integrity ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| CI/CD security checks | GitHub Actions | ✅ |
| Pre-commit hooks | Husky + lint-staged | ✅ |
| Code review required | Branch protection rules | ✅ |
| No eval/Function | ESLint rules enforced | ✅ |

### A09:2021 — Logging & Monitoring ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| Auth event logging | AuditService (13 event types) | ✅ |
| Structured logging | NestJS Logger with context | ✅ |
| IP tracking (masked) | Privacy-conscious logging | ✅ |
| Threat detection helpers | `isSecurityThreat()` on AuditLog | ✅ |

### A10:2021 — SSRF ✅

| Control | Implementation | Status |
|---------|---------------|--------|
| No user-controlled URLs | API doesn't make outbound requests from user input | ✅ |
| JWKS URI hardcoded | Auth0 domain from env config | ✅ |
| Genkit API calls | Only to Google AI API (trusted) | ✅ |

---

## 🛡️ Input Validation

### DTO Validation

Always use class-validator decorators:

```typescript
export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsEnum(SourceType)
  sourceType: SourceType;
}
```

### File Upload Validation

```typescript
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(pdf|markdown)$/)) {
        return callback(new Error('Only PDF and Markdown files allowed'), false);
      }
      callback(null, true);
    },
  }),
)
```

---

## 🔐 Object Injection Prevention

Only use dynamic property access with validated keys:

```typescript
// ✅ GOOD - Validated keys from predefined array
const allowedKeys = ['title', 'author', 'subject'] as const;
for (const key of allowedKeys) {
  const value = pdfInfo[key];
  if (typeof value === 'string') {
    metadata[key] = value;
  }
}

// ❌ BAD - User-controlled keys
const key = req.query.field; // User input
const value = object[key]; // Unsafe!
```

---

## 🔒 Environment Variables

### Required Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AUTH0_DOMAIN` | Auth0 tenant domain | `your-tenant.auth0.com` |
| `AUTH0_AUDIENCE` | API identifier | `https://api.contextai.com` |
| `AUTH0_ISSUER` | Auth0 issuer URL (with trailing `/`) | `https://your-tenant.auth0.com/` |
| `INTERNAL_API_KEY` | Server-to-server shared secret | `openssl rand -hex 32` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PASSWORD` | PostgreSQL password | `***` |
| `GCP_PROJECT_ID` | Google Cloud project ID (Vertex AI) | `my-project` |
| `PINECONE_API_KEY` | Pinecone vector store API key | `pcsk_...` |

### Security Rules

- ❌ NEVER commit `.env` files
- ✅ Use `.env.example` with placeholder values
- ✅ Validate required vars at startup
- ✅ Use ConfigService for typed access

---

## 🚨 Error Handling

### Secure Error Messages

```typescript
// ❌ BAD - Leaks implementation details
throw new Error(`Database connection failed at ${dbHost}:${dbPort}`);

// ✅ GOOD - Generic message to user, detailed log
logger.error('Database connection failed', { host: dbHost, port: dbPort });
throw new InternalServerErrorException('Service temporarily unavailable');
```

### Authentication Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| No token | 401 | "Authentication token is required" |
| Expired token | 401 | "Token has expired" |
| Invalid token | 401 | "Invalid token" |
| Revoked token | 401 | "Token has been revoked" |
| Missing permission | 403 | "Access denied. Required permission: X" |
| Missing role | 403 | "Access denied. Required role: X" |
| Rate limited | 429 | "Too Many Requests" |

---

## 🔍 Security Testing

### Unit Tests (530+)

```bash
pnpm test          # All unit tests
pnpm test:watch    # TDD workflow
```

Covered modules:
- `JwtAuthGuard` (token validation, revocation, public routes)
- `RBACGuard` (permissions, roles, edge cases)
- `TokenRevocationService` (revoke, check, cleanup, statistics)
- `AuditService` (event logging, privacy, error handling)
- `PermissionService` (user roles, permissions, access checks)

### E2E Tests (42 tests)

```bash
pnpm jest --config ./test/jest-e2e.json --testPathPatterns="auth-e2e" --forceExit
```

Covered scenarios:
- Public routes (@Public decorator)
- JWT authentication (7 scenarios)
- Token revocation (4 scenarios)
- Permission-based access (5 scenarios)
- Role-based access (4 scenarios)
- Combined guards (3 scenarios)
- @CurrentUser decorator (2 scenarios)
- Security edge cases (5 scenarios)
- Response format validation (3 scenarios)

### Validation Checklist

```bash
# MANDATORY before every commit
pnpm lint          # ESLint + security rules
pnpm build         # TypeScript strict type checking
pnpm test          # Unit tests (530+)
```

---

## 📋 Security Checklist

### Phase 6 — Implemented ✅

- [x] Auth0 JWT authentication with JWKS
- [x] RS256 asymmetric key validation
- [x] Global JwtAuthGuard (APP_GUARD)
- [x] @Public() decorator for opt-out
- [x] User sync on first login (Auth0 → PostgreSQL)
- [x] RBAC with roles and permissions
- [x] @RequirePermissions decorator (ALL/ANY modes)
- [x] @RequireRoles decorator
- [x] RBACGuard with structured logging
- [x] PermissionService (DB-backed)
- [x] Default roles seeder (user, manager, admin)
- [x] Token revocation (immediate logout)
- [x] Rate limiting (3-tier + AI-specific)
- [x] Audit logging (13 event types)
- [x] @CurrentUser decorator (type-safe)
- [x] E2E tests for auth pipeline (42 tests)
- [x] Unit tests for all auth modules (530+ total)

### Pre-Production Checklist

- [ ] Configure real Auth0 tenant credentials
- [ ] Set up HTTPS/TLS termination
- [ ] Configure CORS for production domains
- [ ] Enable Helmet security headers
- [ ] Set up Redis for token revocation (multi-instance)
- [ ] Configure external audit log storage
- [ ] Set up monitoring/alerting for security events
- [ ] Run penetration testing
- [ ] Review and harden rate limiting thresholds
- [ ] Enable Snyk continuous monitoring

---

## 📚 References

- **Auth0 Docs**: https://auth0.com/docs
- **OWASP Top 10 (2021)**: https://owasp.org/www-project-top-ten
- **NestJS Security**: https://docs.nestjs.com/security/authentication
- **OWASP Cheat Sheets**: https://cheatsheetseries.owasp.org
- **CWE Top 25**: https://cwe.mitre.org/top25
- **JWT Best Practices (RFC 8725)**: https://datatracker.ietf.org/doc/html/rfc8725

---

**Last Updated**: 2026-02-11
**Version**: 2.0.0 (Phase 6 — Auth & Authorization)
**Status**: ✅ Active
