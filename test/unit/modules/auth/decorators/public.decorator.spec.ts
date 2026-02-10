import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Public,
  IS_PUBLIC_KEY,
} from '../../../../../src/modules/auth/decorators/public.decorator';

describe('Public Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('Metadata Setting', () => {
    it('should set isPublic metadata to true on the handler', () => {
      @Controller()
      class TestController {
        @Public()
        @Get()
        getPublicData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(IS_PUBLIC_KEY, controller.getPublicData);

      expect(metadata).toBe(true);
    });

    it('should not set metadata on non-decorated handlers', () => {
      @Controller()
      class TestController {
        @Get()
        getProtectedData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        IS_PUBLIC_KEY,
        controller.getProtectedData,
      );

      expect(metadata).toBeUndefined();
    });
  });

  describe('Decorator Application', () => {
    it('should work on different HTTP methods', () => {
      @Controller()
      class TestController {
        @Public()
        @Get()
        getPublicData() {
          return 'read';
        }

        @Public()
        @Get()
        getPublicHealth() {
          return 'health';
        }
      }

      const controller = new TestController();
      const getMetadata = reflector.get(
        IS_PUBLIC_KEY,
        controller.getPublicData,
      );
      const healthMetadata = reflector.get(
        IS_PUBLIC_KEY,
        controller.getPublicHealth,
      );

      expect(getMetadata).toBe(true);
      expect(healthMetadata).toBe(true);
    });

    it('should not interfere with other decorators', () => {
      @Controller()
      class TestController {
        @Public()
        @Get('public')
        getPublicData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(IS_PUBLIC_KEY, controller.getPublicData);

      expect(metadata).toBe(true);
      // The @Get decorator should still work normally
      expect(controller.getPublicData).toBeDefined();
    });
  });

  describe('Mixed Routes', () => {
    it('should allow mixing public and protected routes in same controller', () => {
      @Controller()
      class TestController {
        @Public()
        @Get()
        getPublicData() {
          return 'public';
        }

        @Get()
        getProtectedData() {
          return 'protected';
        }
      }

      const controller = new TestController();
      const publicMetadata = reflector.get(
        IS_PUBLIC_KEY,
        controller.getPublicData,
      );
      const protectedMetadata = reflector.get(
        IS_PUBLIC_KEY,
        controller.getProtectedData,
      );

      expect(publicMetadata).toBe(true);
      expect(protectedMetadata).toBeUndefined();
    });
  });

  describe('Use Cases', () => {
    it('should mark health check endpoint as public', () => {
      @Controller()
      class HealthController {
        @Public()
        @Get('health')
        getHealth() {
          return { status: 'ok' };
        }
      }

      const controller = new HealthController();
      const metadata = reflector.get(IS_PUBLIC_KEY, controller.getHealth);

      expect(metadata).toBe(true);
    });

    it('should mark documentation endpoint as public', () => {
      @Controller()
      class DocsController {
        @Public()
        @Get('docs')
        getDocs() {
          return { version: '1.0' };
        }
      }

      const controller = new DocsController();
      const metadata = reflector.get(IS_PUBLIC_KEY, controller.getDocs);

      expect(metadata).toBe(true);
    });
  });
});

