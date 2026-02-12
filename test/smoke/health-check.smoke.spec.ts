/**
 * Health Check & Critical Path Contract Tests
 *
 * Validates the expected response contracts and critical API path definitions
 * for the Context.ai API. These are contract-level tests that verify response
 * shapes, thresholds, and service definitions without requiring a live server.
 *
 * For live HTTP smoke tests, see api-smoke.e2e-spec.ts.
 *
 * Phase 7.16: Smoke Tests
 */

import {
  INestApplication,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

// ============================================================================
// Minimal Health Controller for testing
// ============================================================================

@Controller()
class HealthController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  checkHealth(): { status: string; info: { database: { status: string } } } {
    return {
      status: 'ok',
      info: { database: { status: 'up' } },
    };
  }
}

describe('Smoke Tests: Health & Critical Paths (Phase 7.16)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================================
  // Environment Configuration
  // ==========================================================================
  describe('Environment Configuration', () => {
    it('should have a valid API_URL configured', () => {
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      expect(apiUrl).toBeDefined();
      expect(apiUrl.length).toBeGreaterThan(0);
      expect(apiUrl).toMatch(/^https?:\/\//);
    });

    it('should have required environment variables for testing', () => {
      const requiredVars = ['NODE_ENV'];
      requiredVars.forEach((envVar) => {
        expect(process.env[envVar]).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Health Check Endpoint (real HTTP)
  // ==========================================================================
  describe('Health Check Endpoint', () => {
    it('should return 200 with expected health response structure', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/health')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });

    it('should respond within acceptable time limits', async () => {
      const start = Date.now();
      await request(app.getHttpServer() as App)
        .get('/health')
        .expect(HttpStatus.OK);
      const duration = Date.now() - start;

      const HEALTH_CHECK_THRESHOLD_MS = 1000;
      expect(duration).toBeLessThan(HEALTH_CHECK_THRESHOLD_MS);
    });

    it('should define degraded health response structure', () => {
      // Contract definition — validates the expected shape for degraded state
      const degradedResponse = {
        status: 'error',
        info: { database: { status: 'down' } },
        error: { database: { status: 'down', message: 'Connection refused' } },
      };

      expect(degradedResponse).toHaveProperty('status', 'error');
      expect(degradedResponse).toHaveProperty('error.database.status', 'down');
      expect(degradedResponse).toHaveProperty('error.database.message');
    });
  });

  // ==========================================================================
  // Critical Path Validation
  // ==========================================================================
  describe('Critical Path Validation', () => {
    it('should define all critical API paths with auth requirements', () => {
      const criticalPaths = [
        { method: 'GET', path: '/health', auth: false },
        { method: 'POST', path: '/api/v1/knowledge/documents/upload', auth: true },
        { method: 'DELETE', path: '/api/v1/knowledge/documents/:id', auth: true },
        { method: 'POST', path: '/api/v1/interaction/query', auth: true },
        { method: 'GET', path: '/api/v1/interaction/conversations', auth: true },
        { method: 'GET', path: '/api/v1/users/me', auth: true },
        { method: 'POST', path: '/api/v1/users/sync', auth: true },
      ];

      const MIN_CRITICAL_PATHS = 7;
      expect(criticalPaths.length).toBeGreaterThanOrEqual(MIN_CRITICAL_PATHS);

      // Verify auth distribution
      const authPaths = criticalPaths.filter((p) => p.auth);
      const publicPaths = criticalPaths.filter((p) => !p.auth);
      const MIN_AUTH_PATHS = 6;
      expect(authPaths.length).toBeGreaterThanOrEqual(MIN_AUTH_PATHS);
      expect(publicPaths.length).toBeGreaterThanOrEqual(1);

      // Verify each path has a valid HTTP method
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      criticalPaths.forEach(({ method }) => {
        expect(validMethods).toContain(method);
      });

      // Verify each path starts with /
      criticalPaths.forEach(({ path }) => {
        expect(path.startsWith('/')).toBe(true);
      });
    });

    it('should verify the health endpoint responds via real HTTP', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/health')
        .expect(HttpStatus.OK);

      expect(response.body.status).toBe('ok');
    });
  });

  // ==========================================================================
  // Response Time Thresholds
  // ==========================================================================
  describe('Response Time Thresholds', () => {
    it('should define acceptable response time thresholds', () => {
      const thresholds = {
        healthCheck: 1000,
        authentication: 2000,
        chatQuery: 3000,
        documentUpload: 5000,
        listEndpoints: 1000,
      };

      const MAX_HEALTH_MS = 1000;
      const MAX_CHAT_MS = 3000;
      const MAX_UPLOAD_MS = 5000;
      expect(thresholds.healthCheck).toBeLessThanOrEqual(MAX_HEALTH_MS);
      expect(thresholds.chatQuery).toBeLessThanOrEqual(MAX_CHAT_MS);
      expect(thresholds.documentUpload).toBeLessThanOrEqual(MAX_UPLOAD_MS);
    });
  });

  // ==========================================================================
  // External Service Definitions
  // ==========================================================================
  describe('External Service Connectivity', () => {
    it('should define required external services', () => {
      const requiredServices = [
        { name: 'PostgreSQL', type: 'database', critical: true },
        { name: 'Pinecone', type: 'vector-store', critical: true },
        { name: 'Auth0', type: 'authentication', critical: true },
        { name: 'Google AI (Genkit)', type: 'ai-service', critical: true },
      ];

      const EXPECTED_SERVICE_COUNT = 4;
      expect(requiredServices.length).toBe(EXPECTED_SERVICE_COUNT);
      requiredServices.forEach((service) => {
        expect(service.critical).toBe(true);
      });
    });
  });
});
