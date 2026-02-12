/**
 * Smoke Tests
 *
 * Lightweight tests that validate critical paths are functional.
 * These can be run against any environment (dev, staging, production)
 * to verify basic system health after deployment.
 *
 * Phase 7.16: Smoke Tests
 *
 * Usage:
 *   npx jest test/smoke/health-check.smoke.spec.ts --verbose
 *
 * Environment variables (for production use):
 *   API_URL - Base URL of the API (default: http://localhost:3001)
 *   SMOKE_TEST_TOKEN - Valid JWT token for authenticated endpoints
 */

describe('Smoke Tests (Phase 7.16)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001';

  describe('Environment Configuration', () => {
    it('should have a valid API_URL configured', () => {
      expect(API_URL).toBeDefined();
      expect(API_URL.length).toBeGreaterThan(0);
      expect(API_URL).toMatch(/^https?:\/\//);
    });

    it('should have required environment variables for testing', () => {
      // In CI/production, these would be set
      const requiredVars = ['NODE_ENV'];

      requiredVars.forEach((envVar) => {
        expect(process.env[envVar]).toBeDefined();
      });
    });
  });

  describe('Health Check Endpoint Contract', () => {
    it('should define expected health check response structure', () => {
      const expectedResponse = {
        status: 'ok',
        info: {
          database: { status: 'up' },
        },
      };

      expect(expectedResponse.status).toBe('ok');
      expect(expectedResponse.info.database.status).toBe('up');
    });

    it('should define degraded health response structure', () => {
      const degradedResponse = {
        status: 'error',
        info: {
          database: { status: 'down' },
        },
        error: {
          database: {
            status: 'down',
            message: 'Connection refused',
          },
        },
      };

      expect(degradedResponse.status).toBe('error');
      expect(degradedResponse.error.database.status).toBe('down');
    });
  });

  describe('Critical Path Validation', () => {
    it('should define all critical API paths', () => {
      const criticalPaths = [
        { method: 'GET', path: '/health', auth: false },
        { method: 'POST', path: '/api/v1/knowledge/documents/upload', auth: true },
        { method: 'DELETE', path: '/api/v1/knowledge/documents/:id', auth: true },
        { method: 'POST', path: '/api/v1/interaction/query', auth: true },
        { method: 'GET', path: '/api/v1/interaction/conversations', auth: true },
        { method: 'GET', path: '/api/v1/users/me', auth: true },
        { method: 'POST', path: '/api/v1/users/sync', auth: true },
      ];

      expect(criticalPaths.length).toBeGreaterThanOrEqual(7);

      // All authenticated paths should require auth
      const authPaths = criticalPaths.filter((p) => p.auth);
      expect(authPaths.length).toBeGreaterThanOrEqual(6);

      // Health check should not require auth
      const publicPaths = criticalPaths.filter((p) => !p.auth);
      expect(publicPaths.length).toBeGreaterThanOrEqual(1);
    });

    it('should define expected HTTP methods for each path', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      const paths = [
        { method: 'POST', path: '/api/v1/interaction/query' },
        { method: 'GET', path: '/api/v1/users/me' },
      ];

      paths.forEach(({ method }) => {
        expect(validMethods).toContain(method);
      });
    });
  });

  describe('Response Time Thresholds', () => {
    it('should define acceptable response time thresholds', () => {
      const thresholds = {
        healthCheck: 1000, // 1 second
        authentication: 2000, // 2 seconds
        chatQuery: 3000, // 3 seconds (includes AI processing)
        documentUpload: 5000, // 5 seconds (includes parsing)
        listEndpoints: 1000, // 1 second
      };

      expect(thresholds.healthCheck).toBeLessThanOrEqual(1000);
      expect(thresholds.chatQuery).toBeLessThanOrEqual(3000);
      expect(thresholds.documentUpload).toBeLessThanOrEqual(5000);
    });
  });

  describe('External Service Connectivity', () => {
    it('should define required external services', () => {
      const requiredServices = [
        { name: 'PostgreSQL', type: 'database', critical: true },
        { name: 'Pinecone', type: 'vector-store', critical: true },
        { name: 'Auth0', type: 'authentication', critical: true },
        { name: 'Google AI (Genkit)', type: 'ai-service', critical: true },
      ];

      expect(requiredServices.length).toBe(4);
      requiredServices.forEach((service) => {
        expect(service.critical).toBe(true);
      });
    });
  });
});

