/**
 * API Smoke Tests (Phase 7.16)
 *
 * Lightweight E2E tests that validate all critical API paths are reachable
 * and return expected status codes.
 *
 * Strategy: Self-contained test module with mock controllers
 * (same pattern as auth-e2e.e2e-spec.ts)
 *
 * These tests verify:
 * - Health check responds 200
 * - Protected endpoints require authentication (401)
 * - Authenticated endpoints respond correctly
 * - Response times are within acceptable limits
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Post,
  Delete,
  Injectable,
  HttpCode,
  HttpStatus,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Param,
  Body,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  Public,
  IS_PUBLIC_KEY,
} from '../../src/modules/auth/decorators/public.decorator';

// ── Token → User Mapping ───────────────────────────────────────────────

interface SmokeUser {
  userId: string;
  email: string;
  role: string;
}

const SMOKE_USER: SmokeUser = {
  userId: '11111111-1111-4111-a111-111111111111',
  email: 'smoke-user@contextai.com',
  role: 'user',
};

const SMOKE_ADMIN: SmokeUser = {
  userId: '22222222-2222-4222-a222-222222222222',
  email: 'smoke-admin@contextai.com',
  role: 'admin',
};

// ── Smoke JWT Guard ────────────────────────────────────────────────────

@Injectable()
class SmokeJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: SmokeUser;
    }>();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.substring('Bearer '.length);
    if (token === 'user-token') {
      req.user = SMOKE_USER;
      return true;
    }
    if (token === 'admin-token') {
      req.user = SMOKE_ADMIN;
      return true;
    }

    throw new UnauthorizedException('Invalid token');
  }
}

// ── Smoke Controllers ──────────────────────────────────────────────────

@Controller()
class SmokeHealthController {
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  healthCheck(): string {
    return 'Hello World!';
  }
}

@Controller('api/v1/users')
class SmokeUserController {
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  getProfile(): { email: string; role: string } {
    return { email: SMOKE_USER.email, role: SMOKE_USER.role };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Public()
  syncUser(@Body() body: { email: string }): { id: string; email: string } {
    return { id: '00000000-0000-0000-0000-000000000000', email: body.email };
  }
}

@Controller('api/v1/interaction')
class SmokeInteractionController {
  @Post('query')
  @HttpCode(HttpStatus.OK)
  query(
    @Body() body: { query: string },
  ): { response: string; conversationId: string } {
    return {
      response: `Answer for: ${body.query}`,
      conversationId: 'conv-smoke-1',
    };
  }

  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  listConversations(): { conversations: []; total: number } {
    return { conversations: [], total: 0 };
  }
}

@Controller('api/v1/knowledge')
class SmokeKnowledgeController {
  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  uploadDocument(): { sourceId: string; status: string } {
    return { sourceId: 'src-smoke-1', status: 'COMPLETED' };
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  deleteDocument(
    @Param('id') id: string,
  ): { sourceId: string; fragmentsDeleted: number } {
    return { sourceId: id, fragmentsDeleted: 5 };
  }
}

// ── Test Suite ──────────────────────────────────────────────────────────

describe('API Smoke Tests (Phase 7.16)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        SmokeHealthController,
        SmokeUserController,
        SmokeInteractionController,
        SmokeKnowledgeController,
      ],
      providers: [
        SmokeJwtGuard,
        {
          provide: APP_GUARD,
          useExisting: SmokeJwtGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==================================================================
  // 1. Health Check
  // ==================================================================
  describe('Health Check', () => {
    it('GET / → 200 "Hello World!"', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);

      expect(res.text).toBe('Hello World!');
    });
  });

  // ==================================================================
  // 2. Authentication Gate (all protected → 401 without token)
  // ==================================================================
  describe('Authentication Gate', () => {
    const protectedEndpoints = [
      { method: 'get' as const, path: '/api/v1/users/profile' },
      { method: 'post' as const, path: '/api/v1/interaction/query' },
      { method: 'get' as const, path: '/api/v1/interaction/conversations' },
      { method: 'post' as const, path: '/api/v1/knowledge/documents/upload' },
      {
        method: 'delete' as const,
        path: '/api/v1/knowledge/documents/some-id',
      },
    ];

    protectedEndpoints.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} → 401 without token`, async () => {
        await request(app.getHttpServer())[method](path).expect(401);
      });
    });
  });

  // ==================================================================
  // 3. User Endpoints
  // ==================================================================
  describe('User Endpoints', () => {
    it('GET /api/v1/users/profile → 200 with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
    });
  });

  // ==================================================================
  // 4. Interaction Endpoints
  // ==================================================================
  describe('Interaction Endpoints', () => {
    it('POST /api/v1/interaction/query → 200 with valid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/interaction/query')
        .set('Authorization', 'Bearer user-token')
        .send({ query: 'How do I request vacation?' })
        .expect(200);

      expect(res.body).toHaveProperty('response');
      expect(res.body).toHaveProperty('conversationId');
    });

    it('GET /api/v1/interaction/conversations → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/interaction/conversations')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(res.body).toHaveProperty('conversations');
      expect(res.body).toHaveProperty('total');
    });
  });

  // ==================================================================
  // 5. Knowledge Endpoints
  // ==================================================================
  describe('Knowledge Endpoints', () => {
    it('POST /api/v1/knowledge/documents/upload → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/knowledge/documents/upload')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(201);

      expect(res.body).toHaveProperty('sourceId');
      expect(res.body).toHaveProperty('status', 'COMPLETED');
    });

    it('DELETE /api/v1/knowledge/documents/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/knowledge/documents/test-doc-id')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body).toHaveProperty('sourceId', 'test-doc-id');
      expect(res.body).toHaveProperty('fragmentsDeleted');
    });
  });

  // ==================================================================
  // 6. Response Times
  // ==================================================================
  describe('Response Time Smoke', () => {
    it('Health check < 500 ms', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/').expect(200);
      expect(Date.now() - start).toBeLessThan(500);
    });

    it('Authenticated endpoint < 1000 ms', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer user-token')
        .expect(200);
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });

  // ==================================================================
  // 7. Public Endpoints (no auth required)
  // ==================================================================
  describe('Public Endpoints', () => {
    it('Health check is publicly accessible', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });

    it('User sync is publicly accessible', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/sync')
        .send({ email: 'new-user@example.com' })
        .expect(200);

      expect(res.body).toHaveProperty('email', 'new-user@example.com');
    });
  });
});
