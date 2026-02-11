# Rate Limiting

Este documento describe el sistema de rate limiting implementado en Context.ai API para prevenir abuso, ataques DDoS y garantizar fair usage del sistema.

## 📋 Tabla de Contenidos

- [Overview](#overview)
- [Configuración](#configuración)
- [Límites por Endpoint](#límites-por-endpoint)
- [Respuestas HTTP](#respuestas-http)
- [Headers](#headers)
- [Testing](#testing)
- [Monitoreo](#monitoreo)
- [Para Producción](#para-producción)

---

## Overview

**Rate Limiting** (limitación de tasa) es una técnica de seguridad que controla cuántas solicitudes HTTP puede hacer un cliente en un período de tiempo específico.

**Beneficios**:
- ✅ Prevención de ataques DDoS
- ✅ Protección contra abuso de API
- ✅ Fair usage entre usuarios
- ✅ Reducción de costos de LLM (queries limitadas)
- ✅ Mejor estabilidad del sistema

**Implementación**:
- Librería: `@nestjs/throttler`
- Storage: **In-memory** (MVP), Redis (Producción)
- Scope: **Global** + **Per-endpoint overrides**

---

## Configuración

### Tres Niveles de Rate Limiting

El sistema define 3 niveles de rate limiting configurables por environment:

```typescript
// config/throttle.config.ts

1. SHORT - Protección contra bursts
   - TTL: 1 segundo
   - Limit: 10 requests
   - Uso: Endpoints de autenticación, operaciones críticas

2. MEDIUM - Operaciones normales
   - TTL: 1 minuto
   - Limit: 100 requests
   - Uso: Queries, listados, búsquedas

3. LONG - Límite horario
   - TTL: 1 hora
   - Limit: 1000 requests
   - Uso: Límite general de la aplicación
```

### Variables de Entorno

```bash
# .env
THROTTLE_TTL_SHORT=1000          # 1 segundo (default)
THROTTLE_LIMIT_SHORT=10          # 10 requests (default)

THROTTLE_TTL_MEDIUM=60000        # 1 minuto (default)
THROTTLE_LIMIT_MEDIUM=100        # 100 requests (default)

THROTTLE_TTL_LONG=3600000        # 1 hora (default)
THROTTLE_LIMIT_LONG=1000         # 1000 requests (default)
```

### Aplicación Global

El rate limiting está habilitado **globalmente** mediante `APP_GUARD`:

```typescript
// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
]
```

**Nota**: Los endpoints `@Public()` también están protegidos por rate limiting.

---

## Límites por Endpoint

### InteractionController (Chat)

| Endpoint | Método | Límite | TTL | Razón |
|----------|--------|--------|-----|-------|
| `/interaction/query` | POST | 30 req | 1 min | Costoso (LLM calls) |
| `/interaction/conversations` | GET | 50 req | 1 min | Moderado (DB reads) |
| `/interaction/conversations/:id` | GET | 60 req | 1 min | Liviano (single query) |
| `/interaction/conversations/:id` | DELETE | 20 req | 1 min | Write operation |

### Detalle de Límites

#### 1. POST /interaction/query

```typescript
@Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 queries/min
```

**Razón**: Este endpoint es el más costoso porque:
- Hace queries al LLM (Gemini API)
- Consume embedding tokens
- Puede tardar varios segundos
- Costo directo por request

**Límite**: 30 queries por minuto = 1 query cada 2 segundos

#### 2. GET /interaction/conversations

```typescript
@Throttle({ medium: { limit: 50, ttl: 60000 } }) // 50 req/min
```

**Razón**: Endpoint moderado:
- Solo lee de base de datos
- Paginado (no trae todos los datos)
- Usado frecuentemente en UI

**Límite**: 50 requests por minuto

#### 3. GET /interaction/conversations/:id

```typescript
@Throttle({ medium: { limit: 60, ttl: 60000 } }) // 60 req/min
```

**Razón**: Endpoint liviano:
- Una sola query de DB
- No involucra LLM
- Usado para ver historial

**Límite**: 60 requests por minuto

#### 4. DELETE /interaction/conversations/:id

```typescript
@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
```

**Razón**: Operación de escritura:
- Modifica estado en DB
- Menos frecuente que reads
- Prevenir borrado masivo

**Límite**: 20 deletes por minuto

---

## Respuestas HTTP

### Status Code 429 - Too Many Requests

Cuando un cliente excede el límite, el API responde con:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30

{
  "statusCode": 429,
  "message": "Too many requests. Please try again later.",
  "error": "Too Many Requests"
}
```

### Documentación en Swagger

Todos los endpoints protegidos incluyen la respuesta 429 en Swagger:

```typescript
@ApiTooManyRequestsResponse({
  description: 'Too many requests. Rate limit: 30 requests per minute',
  schema: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 429 },
      message: { type: 'string', example: 'Too many requests. Please try again later.' },
      error: { type: 'string', example: 'Too Many Requests' },
    },
  },
})
```

---

## Headers

### Rate Limit Headers

`@nestjs/throttler` incluye headers informativos en cada respuesta:

```http
X-RateLimit-Limit: 30        # Máximo de requests permitidos
X-RateLimit-Remaining: 25    # Requests restantes en esta ventana
X-RateLimit-Reset: 1708444800 # Unix timestamp cuando se resetea
Retry-After: 30              # Segundos hasta que se resetea (solo en 429)
```

### Ejemplo de uso en cliente

```typescript
// Frontend - manejo de rate limit
async function queryAssistant(query: string) {
  try {
    const response = await fetch('/api/interaction/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      
      console.warn(`Rate limited. Retry after ${retryAfter}s. Remaining: ${remaining}`);
      
      // Mostrar mensaje al usuario
      showToast(`Too many requests. Please wait ${retryAfter} seconds.`);
      return;
    }

    return await response.json();
  } catch (error) {
    // Handle error
  }
}
```

---

## Testing

### Unit Tests

```typescript
describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer())
        .post('/interaction/query')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test' })
        .expect(200);
    }
  });

  it('should block requests exceeding limit', async () => {
    // Make 30 successful requests
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer())
        .post('/interaction/query')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test' })
        .expect(200);
    }

    // 31st request should be blocked
    const response = await request(app.getHttpServer())
      .post('/interaction/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'test' })
      .expect(429);

    expect(response.body.message).toContain('Too many requests');
  });

  it('should reset limit after TTL expires', async () => {
    // Make 30 requests
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer())
        .post('/interaction/query')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test' })
        .expect(200);
    }

    // Wait for TTL to expire (60 seconds)
    await new Promise(resolve => setTimeout(resolve, 61000));

    // Should allow requests again
    await request(app.getHttpServer())
      .post('/interaction/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'test' })
      .expect(200);
  });
});
```

### E2E Tests

```bash
# Test rate limiting in E2E environment
pnpm test:e2e rate-limiting.e2e.spec.ts
```

---

## Monitoreo

### Métricas Recomendadas

```typescript
// Prometheus metrics ejemplo
throttle_requests_total{endpoint="/interaction/query",status="200"} 1234
throttle_requests_total{endpoint="/interaction/query",status="429"} 56
throttle_limit_exceeded_total{endpoint="/interaction/query"} 56
```

### Logs

El sistema genera logs cuando se excede el límite:

```typescript
{
  level: 'warn',
  message: 'Rate limit exceeded',
  endpoint: '/interaction/query',
  method: 'POST',
  userId: 'user-uuid-123',
  ip: '192.168.1.1',
  limit: 30,
  ttl: 60000,
  timestamp: '2024-02-20T15:30:00.000Z'
}
```

### Dashboard

Crear dashboard para monitorear:
- **Rate limit hits**: Cuántos 429 por endpoint
- **Top rate-limited users**: Usuarios que exceden límites frecuentemente
- **Average requests per user**: Uso promedio
- **Peak hours**: Horas de mayor tráfico

---

## Para Producción

### Migrar a Redis

Para entornos distribuidos (múltiples instancias), usar Redis como storage compartido:

**1. Instalar Dependencias**

```bash
pnpm add @nestjs/throttler-storage-redis ioredis
pnpm add -D @types/ioredis
```

**2. Actualizar AppModule**

```typescript
// app.module.ts
import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: configService.get('throttle')!.throttlers,
        errorMessage: configService.get('throttle')!.errorMessage,
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
            password: configService.get('REDIS_PASSWORD'),
          })
        ),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

**3. Configurar Redis**

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
```

**4. Docker Compose**

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

**Ventajas de Redis**:
- ✅ Shared state entre instancias
- ✅ Persistencia opcional
- ✅ Alta performance
- ✅ Escalable horizontalmente

### Rate Limiting por Usuario

Para límites específicos por usuario (ej: planes premium):

```typescript
// Custom throttler guard
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = req.user as ValidatedUser;
    return user?.userId || req.ip; // Track by user ID instead of IP
  }

  protected async getLimit(context: ExecutionContext): Promise<number> {
    const user = context.switchToHttp().getRequest().user as ValidatedUser;
    
    // Premium users get higher limits
    if (await this.isPremiumUser(user.userId)) {
      return 100; // 100 queries/min for premium
    }
    
    return 30; // 30 queries/min for free tier
  }
}
```

### Rate Limiting por API Key

Para integraciones externas:

```typescript
@Controller('api/v1')
export class ApiController {
  @Post('query')
  @Throttle({ long: { limit: 10000, ttl: 3600000 } }) // 10k req/hour
  async query(@Headers('x-api-key') apiKey: string) {
    // Validate API key
    // Process query
  }
}
```

---

## Best Practices

### 1. Comunicar Límites Claramente

```typescript
// En documentación Swagger
@ApiOperation({
  summary: 'Query the assistant',
  description: 
    'Send a question to the RAG assistant...' +
    '\n\n**Rate Limit**: 30 requests per minute' +
    '\n\nExceed this limit and you will receive a 429 error.',
})
```

### 2. Proveer Feedback al Usuario

```typescript
// Frontend - mostrar contador de rate limit
function RateLimitIndicator() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Extract from response headers
    setRemaining(response.headers.get('X-RateLimit-Remaining'));
  }, [lastResponse]);

  return (
    <div>
      Queries remaining: {remaining}/30
    </div>
  );
}
```

### 3. Implementar Retry Logic

```typescript
// Frontend - retry automático con backoff
async function queryWithRetry(query: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch('/api/interaction/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue; // Retry
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

### 4. Diferenciar por Tipo de Request

```typescript
// Operaciones críticas: límites más estrictos
@Post('auth/login')
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 intentos/min

// Operaciones normales: límites moderados
@Get('conversations')
@Throttle({ medium: { limit: 50, ttl: 60000 } }) // 50 req/min

// Health checks: sin límite
@Get('health')
@SkipThrottle() // No rate limiting
```

---

## Referencias

- [@nestjs/throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [RFC 6585: HTTP Status Code 429](https://datatracker.ietf.org/doc/html/rfc6585#section-4)
- [OWASP: API Rate Limiting](https://owasp.org/www-community/api-security/api-rate-limiting)

---

**Última actualización**: Febrero 2026  
**Versión**: 1.0.0 (MVP - In-Memory)  
**Autor**: Context.ai Team

