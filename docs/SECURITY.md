# Security Guidelines - Context.ai API

## 🔐 Overview

Este documento describe las prácticas de seguridad aplicadas en el proyecto siguiendo **OWASP Top 10** y **SonarJS** recommendations.

---

## 🎯 Security Standards

### Compliance
- ✅ OWASP Top 10 (2021)
- ✅ CWE Top 25
- ✅ SonarQube Quality Gate
- ✅ GDPR considerations

### Tools
- **SonarJS**: Static code analysis
- **Snyk**: Dependency vulnerability scanning
- **CodeQL**: Security vulnerability detection
- **ESLint**: Code quality and security rules

---

## 🛡️ Applied Security Measures

### 1. **ReDoS Prevention (OWASP A06:2021)**

**Vulnerability**: Regular Expression Denial of Service  
**CWE**: CWE-1333 (Inefficient Regular Expression Complexity)

#### ❌ Vulnerable Pattern
```typescript
// Catastrophic backtracking possible
.replace(/(\*|_)(.*?)\1/g, '$2')
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
```

#### ✅ Secure Pattern
```typescript
// Bounded quantifiers prevent ReDoS
.replace(/[*_]([^*_]+)[*_]/g, '$1')
.replace(/\[([^\]]{1,500})\]\(([^)]{1,500})\)/g, '$1 ($2)')
```

**Prevention Strategies**:
1. **Limit quantifiers**: Use `{min,max}` instead of `*` or `+`
2. **Avoid nested quantifiers**: Never use `(a+)+` patterns
3. **Use atomic groups**: Prevent backtracking when possible
4. **Test with long inputs**: Verify performance with edge cases

---

### 2. **Input Validation**

All user inputs are validated before processing:

```typescript
private validateBuffer(buffer: Buffer): void {
  if (buffer == null) {
    throw new Error('Buffer cannot be null or undefined');
  }

  if (buffer.length === 0) {
    throw new Error('Buffer cannot be empty');
  }
}
```

**Rules**:
- ✅ Never trust user input
- ✅ Validate type, format, and length
- ✅ Fail fast with clear error messages
- ✅ Use TypeScript strict mode

---

### 3. **Magic Numbers Elimination**

#### ❌ Bad
```typescript
if (buffer.length < 4) {
  return false;
}
const signature = buffer.toString('utf-8', 0, 4);
return signature === '%PDF';
```

#### ✅ Good
```typescript
const PDF_SIGNATURE_LENGTH = 4;
const PDF_SIGNATURE = '%PDF';

if (buffer.length < PDF_SIGNATURE_LENGTH) {
  return false;
}
const signature = buffer.toString('utf-8', 0, PDF_SIGNATURE_LENGTH);
return signature === PDF_SIGNATURE;
```

**Benefits**:
- Code is self-documenting
- Easy to maintain and update
- No scattered magic values

---

### 4. **Cognitive Complexity (≤15)**

Keep functions simple and focused:

```typescript
// ❌ High complexity (CC: 25)
function processData(input) {
  if (input.type === 'A') {
    if (input.status === 'active') {
      if (input.value > 100) {
        // nested logic...
      }
    }
  } else if (input.type === 'B') {
    // more nested logic...
  }
  // ... continues
}

// ✅ Low complexity (CC: 8)
function processData(input) {
  if (!isValidInput(input)) {
    throw new Error('Invalid input');
  }
  
  const processor = getProcessorForType(input.type);
  return processor.process(input);
}
```

**Rules**:
- ✅ Extract complex conditions to functions
- ✅ Use early returns
- ✅ Apply Single Responsibility Principle
- ✅ Keep CC ≤ 15

---

### 5. **Error Handling**

Never expose sensitive information in errors:

```typescript
// ❌ Bad - Exposes internal details
catch (error) {
  throw new Error(`Database connection failed: ${dbConnectionString}`);
}

// ✅ Good - Generic message, log details internally
catch (error) {
  logger.error('Database connection failed', { error, context });
  throw new Error('Failed to connect to database');
}
```

---

### 6. **Type Safety**

Always use explicit types, never `any`:

```typescript
// ❌ Bad
const data: any = await fetchData();

// ✅ Good
interface PdfParseResult {
  text: string;
  numpages: number;
  info: Record<string, any>;
}

const data: PdfParseResult = await pdfParse(buffer);
```

---

### 7. **Dependency Security**

**Snyk Configuration** (`.snyk`):
```yaml
severity-threshold: high
exclude:
  global:
    - node_modules/**
    - dist/**
```

**Regular Updates**:
```bash
# Check for vulnerabilities
pnpm audit

# Fix automatically
pnpm audit --fix

# Snyk scan
snyk test

# Update dependencies
pnpm update
```

---

## 🔍 Code Review Checklist

Before committing code, verify:

### Security
- [ ] No hardcoded credentials or secrets
- [ ] Input validation implemented
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No ReDoS patterns
- [ ] Error messages don't expose sensitive data

### Code Quality
- [ ] Cognitive Complexity ≤ 15
- [ ] No magic numbers
- [ ] No duplicate code
- [ ] No identical functions
- [ ] All functions have single responsibility
- [ ] Type-safe (no `any`)

### Testing
- [ ] Unit tests cover new code
- [ ] Tests follow TDD (Red-Green-Refactor)
- [ ] Edge cases tested
- [ ] Error cases tested
- [ ] Coverage ≥ 80%

### Performance
- [ ] No N+1 queries
- [ ] Efficient algorithms
- [ ] No memory leaks
- [ ] Bounded loops and recursion

---

## 🚨 Common Vulnerabilities to Avoid

### 1. **SQL Injection**
```typescript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Safe - Use parameterized queries
const query = 'SELECT * FROM users WHERE id = $1';
db.query(query, [userId]);
```

### 2. **XSS (Cross-Site Scripting)**
```typescript
// ❌ Vulnerable
res.send(`<h1>Hello ${username}</h1>`);

// ✅ Safe - Sanitize input
import { escape } from 'validator';
res.send(`<h1>Hello ${escape(username)}</h1>`);
```

### 3. **Path Traversal**
```typescript
// ❌ Vulnerable
const filePath = path.join(baseDir, req.params.filename);

// ✅ Safe - Validate path
import { normalize, resolve } from 'path';
const filePath = resolve(baseDir, req.params.filename);
if (!filePath.startsWith(resolve(baseDir))) {
  throw new Error('Invalid path');
}
```

### 4. **Unvalidated Redirects**
```typescript
// ❌ Vulnerable
res.redirect(req.query.url);

// ✅ Safe - Whitelist allowed URLs
const allowedHosts = ['example.com', 'subdomain.example.com'];
const url = new URL(req.query.url);
if (allowedHosts.includes(url.hostname)) {
  res.redirect(req.query.url);
}
```

---

## 📚 Resources

### OWASP
- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

### CWE
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [CWE-1333: ReDoS](https://cwe.mitre.org/data/definitions/1333.html)

### SonarQube
- [SonarJS Rules](https://rules.sonarsource.com/javascript)
- [Cognitive Complexity](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)

### TypeScript
- [TypeScript Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

## 🔐 Phase 6: Authentication & Authorization

Phase 6 added comprehensive security infrastructure:

### Implemented Components

| Component | Description | Documentation |
|-----------|-------------|---------------|
| **JWT Auth** | Auth0 JWKS validation (RS256) | [SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md) |
| **RBAC** | Role-based access control (3 roles, 9 permissions) | [RBAC_SEEDING_STRATEGY.md](RBAC_SEEDING_STRATEGY.md) |
| **Token Revocation** | Immediate logout capability | [TOKEN_REVOCATION.md](TOKEN_REVOCATION.md) |
| **Rate Limiting** | 3-tier DDoS protection | [RATE_LIMITING.md](RATE_LIMITING.md) |
| **Audit Logging** | 14 security event types | [SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md) |
| **E2E Tests** | 42 auth pipeline tests | `test/e2e/auth-e2e.e2e-spec.ts` |

### Security Guard Pipeline

```
Request → ThrottlerGuard → JwtAuthGuard → RBACGuard → Controller
              429              401           403          200
```

For comprehensive details, see [SECURITY_GUIDELINES.md](SECURITY_GUIDELINES.md).

---

## 🔄 Continuous Improvement

Security is an ongoing process:

1. **Weekly**: Review Snyk reports
2. **Monthly**: Update dependencies
3. **Quarterly**: Security audit
4. **Annually**: Penetration testing

---

**Last Updated**: 2026-02-11
**Version**: 2.0.0 (Phase 6 — Auth & Authorization)
**Status**: ✅ Active

