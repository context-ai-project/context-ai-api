# Security Guidelines

This document outlines security practices and OWASP Top 10 compliance for Context.AI API.

---

## 🔒 OWASP Top 10 Compliance

### 1. Injection Prevention

**SQL Injection**:
- ✅ Use TypeORM parameterized queries (automatic)
- ✅ Never concatenate user input into SQL
- ✅ Validate all inputs with DTOs

```typescript
// ✅ GOOD - TypeORM handles parameterization
const source = await repository.findOne({
  where: { id: userInput },
});

// ❌ BAD - Raw SQL with concatenation
const query = `SELECT * FROM sources WHERE id = '${userInput}'`;
```

**NoSQL Injection**:
- Validate input types
- Use schema validation

**Command Injection**:
- Never execute shell commands with user input
- If necessary, use allowlists and escape properly

### 2. Broken Authentication

**Requirements**:
- ✅ Implement JWT-based authentication
- ✅ Use strong password hashing (bcrypt)
- ✅ Implement rate limiting
- ✅ Use secure session management

```typescript
// Example JWT validation
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  @Post('upload')
  async uploadDocument(@Request() req) {
    const userId = req.user.id; // From validated JWT
    // ...
  }
}
```

### 3. Sensitive Data Exposure

**Requirements**:
- ❌ Never log sensitive data (passwords, tokens, API keys)
- ✅ Use environment variables for secrets
- ✅ Encrypt data at rest
- ✅ Use HTTPS in production
- ✅ Mask sensitive data in logs

```typescript
// ❌ BAD - Logging sensitive data
logger.log(`User password: ${user.password}`);

// ✅ GOOD - Mask sensitive data
logger.log(`User login: ${user.email} (id: ${user.id})`);

// ✅ GOOD - Use environment variables
const apiKey = process.env.GENKIT_API_KEY;
```

### 4. XML External Entities (XXE)

- Disable XML external entity processing
- Validate XML inputs
- Use JSON instead of XML when possible

### 5. Broken Access Control

**Requirements**:
- ✅ Implement RBAC (Role-Based Access Control)
- ✅ Validate user permissions on every request
- ✅ Implement ownership checks

```typescript
// Example: Check resource ownership
async deleteSource(sourceId: string, userId: string) {
  const source = await this.repository.findById(sourceId);
  
  if (!source) {
    throw new NotFoundException('Source not found');
  }
  
  if (source.userId !== userId) {
    throw new ForbiddenException('You do not own this source');
  }
  
  await this.repository.delete(sourceId);
}
```

### 6. Security Misconfiguration

**Requirements**:
- ✅ Keep dependencies updated
- ✅ Disable unnecessary features
- ✅ Use security headers
- ✅ Configure CORS properly

```typescript
// main.ts - Security headers
app.use(helmet());
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
});
```

### 7. Cross-Site Scripting (XSS)

**Requirements**:
- ✅ Sanitize user input
- ✅ Use Content Security Policy (CSP)
- ✅ Escape HTML in responses

```typescript
// Example: Sanitize HTML
import * as sanitizeHtml from 'sanitize-html';

function sanitizeUserInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
  });
}
```

### 8. Insecure Deserialization

**Requirements**:
- ✅ Validate all JSON inputs with DTOs
- ✅ Don't deserialize untrusted data
- ✅ Use class-validator for input validation

```typescript
// ✅ GOOD - DTO validation
export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsEnum(SourceType)
  sourceType: SourceType;
}
```

### 9. Using Components with Known Vulnerabilities

**Requirements**:
- ✅ Run `pnpm audit` regularly
- ✅ Use Snyk or Dependabot
- ✅ Update dependencies promptly
- ✅ Monitor security advisories

```bash
# Check for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit fix
```

### 10. Insufficient Logging & Monitoring

**Requirements**:
- ✅ Log all authentication attempts
- ✅ Log all authorization failures
- ✅ Log all input validation failures
- ✅ Monitor for suspicious patterns

```typescript
// ✅ GOOD - Structured logging
logger.warn('Failed login attempt', {
  email: user.email,
  ip: request.ip,
  timestamp: new Date(),
});

logger.error('Authorization failed', {
  userId: user.id,
  resource: resourceId,
  action: 'delete',
});
```

---

## 🛡️ Input Validation

### DTO Validation

Always use class-validator decorators:

```typescript
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/) // Alphanumeric, spaces, hyphens, underscores
  title: string;

  @IsUUID()
  sectorId: string;

  @IsEnum(SourceType)
  sourceType: SourceType;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}
```

### File Upload Validation

```typescript
@UseInterceptors(
  FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(pdf|markdown)$/)) {
        return callback(new Error('Only PDF and Markdown files allowed'), false);
      }
      callback(null, true);
    },
  }),
)
async uploadDocument(@UploadedFile() file: Express.Multer.File) {
  // Validate file content
  if (!this.isValidPdf(file.buffer)) {
    throw new BadRequestException('Invalid PDF file');
  }
}
```

---

## 🔐 Object Injection Prevention

### Dynamic Property Access

Only use dynamic property access with validated keys:

```typescript
// ✅ GOOD - Validated keys
const allowedKeys = ['title', 'author', 'subject'] as const;
const metadata: Record<string, string> = {};

for (const key of allowedKeys) {
  // eslint-disable-next-line security/detect-object-injection -- Safe: key is from predefined array
  const value = pdfInfo[key];
  if (typeof value === 'string') {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key is from predefined array
    metadata[key] = value;
  }
}

// ❌ BAD - User-controlled keys
const key = req.query.field; // User input
const value = object[key]; // Unsafe!
```

---

## 🔒 Environment Variables

### Secrets Management

```typescript
// .env.example (commit this)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=contextai

# NEVER commit actual values
GENKIT_API_KEY=your_api_key_here
JWT_SECRET=your_jwt_secret_here
```

```typescript
// config.service.ts
@Injectable()
export class ConfigService {
  get<T>(key: string): T {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value as unknown as T;
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      host: this.get<string>('DATABASE_HOST'),
      port: parseInt(this.get<string>('DATABASE_PORT'), 10),
      username: this.get<string>('DATABASE_USER'),
      password: this.get<string>('DATABASE_PASSWORD'),
      database: this.get<string>('DATABASE_NAME'),
    };
  }
}
```

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

### Custom Error Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Log full error details
    logger.error('Unhandled exception', {
      error: exception,
      path: request.url,
      method: request.method,
    });

    // Return sanitized error to client
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

---

## 🔍 Security Testing

### Local Security Checks

```bash
# Run ESLint with security plugin
pnpm lint

# Audit dependencies
pnpm audit

# Check for hardcoded secrets
git secrets --scan
```

### CI/CD Security Checks

GitHub Actions runs:
1. **ESLint with eslint-plugin-security**
2. **CodeQL analysis**
3. **Dependency scanning** (Snyk)
4. **SAST** (Static Application Security Testing)

---

## 🛠️ Security Tools

### eslint-plugin-security

Detects potential security vulnerabilities:

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['security'],
  extends: ['plugin:security/recommended'],
};
```

### CodeQL

Configured in `.github/workflows/codeql.yml`:
- Scans for SQL injection
- Detects XSS vulnerabilities
- Finds command injection
- Identifies path traversal

---

## 📋 Security Checklist

Before deploying:

- [ ] All inputs validated with DTOs
- [ ] No sensitive data in logs
- [ ] Environment variables for all secrets
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Authentication on protected routes
- [ ] Authorization checks on all operations
- [ ] File upload validation
- [ ] Error messages don't leak details
- [ ] Dependencies up to date
- [ ] No critical security alerts

---

## 📚 References

- **OWASP Top 10**: https://owasp.org/www-project-top-ten
- **NestJS Security**: https://docs.nestjs.com/security/authentication
- **OWASP Cheat Sheets**: https://cheatsheetseries.owasp.org
- **Node.js Security Best Practices**: https://nodejs.org/en/docs/guides/security

