/**
 * Sector Isolation E2E Tests (Phase 7.4)
 *
 * Tests that the RBAC + namespace system properly isolates
 * data between sectors/tenants.
 *
 * Strategy:
 * - Uses a self-contained test module with mock controllers
 *   (same pattern as auth-e2e.e2e-spec.ts)
 * - TestSectorGuard verifies that the user's allowed sectors
 *   match the requested sectorId
 * - Tests the full HTTP pipeline: Request → Guard → Controller → Response
 *
 * Issue 7.4: Sector Isolation E2E Tests ✅
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Post,
  Injectable,
  HttpCode,
  HttpStatus,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Query,
  Body,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  Public,
  IS_PUBLIC_KEY,
} from '../../src/modules/auth/decorators/public.decorator';

// ── Test Data ──────────────────────────────────────────────────────────

const SECTOR_HR = 'a0e84000-e29b-41d4-a716-446655440001';
const SECTOR_IT = 'b0e84000-e29b-41d4-a716-446655440002';
const SECTOR_FINANCE = 'c0e84000-e29b-41d4-a716-446655440003';

interface TestUser {
  userId: string;
  email: string;
  sectors: string[];
}

const HR_USER: TestUser = {
  userId: '11111111-1111-4111-a111-111111111111',
  email: 'hr-user@contextai.com',
  sectors: [SECTOR_HR],
};

const IT_USER: TestUser = {
  userId: '22222222-2222-4222-a222-222222222222',
  email: 'it-user@contextai.com',
  sectors: [SECTOR_IT],
};

const MULTI_SECTOR_USER: TestUser = {
  userId: '33333333-3333-4333-a333-333333333333',
  email: 'multi-user@contextai.com',
  sectors: [SECTOR_HR, SECTOR_IT],
};

const ADMIN_USER: TestUser = {
  userId: '44444444-4444-4444-a444-444444444444',
  email: 'admin@contextai.com',
  sectors: [SECTOR_HR, SECTOR_IT, SECTOR_FINANCE],
};

// Token → User mapping
const TOKEN_MAP: Record<string, TestUser> = {
  'hr-token': HR_USER,
  'it-token': IT_USER,
  'multi-token': MULTI_SECTOR_USER,
  'admin-token': ADMIN_USER,
};

// ── Sector knowledge store (in-memory) ─────────────────────────────────

const SECTOR_KNOWLEDGE: Record<string, { id: string; content: string }[]> = {
  [SECTOR_HR]: [
    { id: 'hr-1', content: 'HR vacation policy: 15 days notice required' },
    { id: 'hr-2', content: 'HR onboarding: first-day checklist' },
  ],
  [SECTOR_IT]: [
    { id: 'it-1', content: 'IT security: all passwords must be 16+ chars' },
    { id: 'it-2', content: 'IT setup: VPN configuration guide' },
  ],
  [SECTOR_FINANCE]: [
    { id: 'fin-1', content: 'Finance: Q4 reporting standards' },
  ],
};

// ── Guards ──────────────────────────────────────────────────────────────

/**
 * Test JWT Guard - maps Bearer tokens to test users
 */
@Injectable()
class TestJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: TestUser;
    }>();
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.substring('Bearer '.length);
    const user = TOKEN_MAP[token];
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    req.user = user;
    return true;
  }
}

/**
 * Sector Guard - ensures user can only access their authorized sectors
 */
@Injectable()
class TestSectorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      user?: TestUser;
      query?: { sectorId?: string };
      body?: { sectorId?: string };
    }>();

    const user = req.user;
    if (!user) return true; // Let JWT guard handle this

    // Extract sectorId from query or body
    const sectorId = req.query?.sectorId || req.body?.sectorId;
    if (!sectorId) return true; // No sector specified, nothing to guard

    if (!user.sectors.includes(sectorId)) {
      throw new ForbiddenException(
        `Access denied: user not authorized for sector ${sectorId}`,
      );
    }

    return true;
  }
}

// ── Test Controller ────────────────────────────────────────────────────

@Controller('test-sector')
class TestSectorController {
  @Public()
  @Get('public')
  @HttpCode(HttpStatus.OK)
  getPublic(): { message: string } {
    return { message: 'Public endpoint' };
  }

  @Get('knowledge')
  @HttpCode(HttpStatus.OK)
  getKnowledge(
    @Query('sectorId') sectorId: string,
  ): { sectorId: string; sources: { id: string; content: string }[] } {
    const sources = SECTOR_KNOWLEDGE[sectorId] || [];
    return { sectorId, sources };
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  queryAssistant(
    @Body() body: { sectorId: string; query: string },
  ): { sectorId: string; answer: string; sourceCount: number } {
    const sources = SECTOR_KNOWLEDGE[body.sectorId] || [];
    return {
      sectorId: body.sectorId,
      answer: `Answer for "${body.query}" using ${sources.length} sources`,
      sourceCount: sources.length,
    };
  }
}

// ── Test Suite ──────────────────────────────────────────────────────────

describe('Sector Isolation E2E Tests (Phase 7.4)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestSectorController],
      providers: [
        TestJwtGuard,
        TestSectorGuard,
        {
          provide: APP_GUARD,
          useExisting: TestJwtGuard,
        },
        {
          provide: APP_GUARD,
          useExisting: TestSectorGuard,
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
  // 1. Basic Sector Access
  // ==================================================================
  describe('Basic Sector Access', () => {
    it('should allow HR user to access HR sector', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_HR })
        .set('Authorization', 'Bearer hr-token')
        .expect(HttpStatus.OK);

      expect(res.body.sectorId).toBe(SECTOR_HR);
      expect(res.body.sources).toHaveLength(2);
    });

    it('should deny HR user access to IT sector', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_IT })
        .set('Authorization', 'Bearer hr-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(res.body.message).toContain('Access denied');
      expect(res.body.message).toContain(SECTOR_IT);
    });

    it('should deny IT user access to HR sector', async () => {
      await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_HR })
        .set('Authorization', 'Bearer it-token')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should allow IT user to access IT sector', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_IT })
        .set('Authorization', 'Bearer it-token')
        .expect(HttpStatus.OK);

      expect(res.body.sectorId).toBe(SECTOR_IT);
      expect(res.body.sources).toHaveLength(2);
    });
  });

  // ==================================================================
  // 2. Multi-Sector User Access
  // ==================================================================
  describe('Multi-Sector User Access', () => {
    it('should allow multi-sector user access to HR', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_HR })
        .set('Authorization', 'Bearer multi-token')
        .expect(HttpStatus.OK);

      expect(res.body.sectorId).toBe(SECTOR_HR);
    });

    it('should allow multi-sector user access to IT', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_IT })
        .set('Authorization', 'Bearer multi-token')
        .expect(HttpStatus.OK);

      expect(res.body.sectorId).toBe(SECTOR_IT);
    });

    it('should deny multi-sector user access to Finance (not authorized)', async () => {
      await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_FINANCE })
        .set('Authorization', 'Bearer multi-token')
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ==================================================================
  // 3. Admin Cross-Sector Access
  // ==================================================================
  describe('Admin Cross-Sector Access', () => {
    it('should allow admin to access all sectors', async () => {
      for (const sectorId of [SECTOR_HR, SECTOR_IT, SECTOR_FINANCE]) {
        const res = await request(app.getHttpServer())
          .get('/test-sector/knowledge')
          .query({ sectorId })
          .set('Authorization', 'Bearer admin-token')
          .expect(HttpStatus.OK);

        expect(res.body.sectorId).toBe(sectorId);
      }
    });
  });

  // ==================================================================
  // 4. Chat Query Isolation
  // ==================================================================
  describe('Chat Query Sector Isolation', () => {
    it('should allow user to query their authorized sector', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-sector/query')
        .set('Authorization', 'Bearer hr-token')
        .send({ sectorId: SECTOR_HR, query: 'vacation policy' })
        .expect(HttpStatus.OK);

      expect(res.body.sectorId).toBe(SECTOR_HR);
      expect(res.body.sourceCount).toBe(2);
    });

    it('should deny user query to unauthorized sector', async () => {
      await request(app.getHttpServer())
        .post('/test-sector/query')
        .set('Authorization', 'Bearer hr-token')
        .send({ sectorId: SECTOR_IT, query: 'VPN setup' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return different sources per sector', async () => {
      const hrRes = await request(app.getHttpServer())
        .post('/test-sector/query')
        .set('Authorization', 'Bearer admin-token')
        .send({ sectorId: SECTOR_HR, query: 'general query' })
        .expect(HttpStatus.OK);

      const itRes = await request(app.getHttpServer())
        .post('/test-sector/query')
        .set('Authorization', 'Bearer admin-token')
        .send({ sectorId: SECTOR_IT, query: 'general query' })
        .expect(HttpStatus.OK);

      // HR has 2 sources, IT has 2 sources
      expect(hrRes.body.sourceCount).toBe(2);
      expect(itRes.body.sourceCount).toBe(2);
      // But they are different sectors
      expect(hrRes.body.sectorId).not.toBe(itRes.body.sectorId);
    });
  });

  // ==================================================================
  // 5. Data Isolation Verification
  // ==================================================================
  describe('Data Isolation Verification', () => {
    it('HR sector should not leak IT data', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_HR })
        .set('Authorization', 'Bearer hr-token')
        .expect(HttpStatus.OK);

      // Verify no IT content in HR response
      const allContent = res.body.sources
        .map((s: { content: string }) => s.content)
        .join(' ');
      expect(allContent).not.toContain('VPN');
      expect(allContent).not.toContain('IT security');
      expect(allContent).toContain('HR');
    });

    it('IT sector should not leak HR data', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_IT })
        .set('Authorization', 'Bearer it-token')
        .expect(HttpStatus.OK);

      const allContent = res.body.sources
        .map((s: { content: string }) => s.content)
        .join(' ');
      expect(allContent).not.toContain('vacation');
      expect(allContent).not.toContain('onboarding');
      expect(allContent).toContain('IT');
    });

    it('Finance sector should be completely isolated', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_FINANCE })
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(res.body.sources).toHaveLength(1);
      const content = res.body.sources[0].content;
      expect(content).toContain('Finance');
      expect(content).not.toContain('HR');
      expect(content).not.toContain('IT');
    });
  });

  // ==================================================================
  // 6. Edge Cases
  // ==================================================================
  describe('Edge Cases', () => {
    it('should still require authentication for sector endpoints', async () => {
      await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: SECTOR_HR })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('public endpoints should not require sector authorization', async () => {
      await request(app.getHttpServer())
        .get('/test-sector/public')
        .expect(HttpStatus.OK);
    });

    it('should handle non-existent sector gracefully', async () => {
      const nonExistentSector = 'ffffffff-ffff-4fff-afff-ffffffffffff';
      await request(app.getHttpServer())
        .get('/test-sector/knowledge')
        .query({ sectorId: nonExistentSector })
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
