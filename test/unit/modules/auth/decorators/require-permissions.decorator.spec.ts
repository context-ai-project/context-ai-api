import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RequirePermissions,
  PERMISSIONS_KEY,
  PERMISSION_MATCH_MODE_KEY,
  PermissionMatchMode,
} from '../../../../../src/modules/auth/decorators/require-permissions.decorator';

describe('RequirePermissions Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('Metadata Setting', () => {
    it('should set permissions metadata on the handler', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read'])
        @Get()
        getKnowledge() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        PERMISSIONS_KEY,
        controller.getKnowledge,
      );

      expect(metadata).toEqual(['knowledge:read']);
    });

    it('should set multiple permissions', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read', 'knowledge:update'])
        @Get()
        getKnowledge() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        PERMISSIONS_KEY,
        controller.getKnowledge,
      );

      expect(metadata).toEqual(['knowledge:read', 'knowledge:update']);
    });

    it('should set default match mode to ALL', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read'])
        @Get()
        getKnowledge() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        PERMISSION_MATCH_MODE_KEY,
        controller.getKnowledge,
      );

      expect(metadata).toBe(PermissionMatchMode.ALL);
    });

    it('should set match mode to ANY when specified', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read', 'chat:read'], {
          mode: PermissionMatchMode.ANY,
        })
        @Get()
        getData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        PERMISSION_MATCH_MODE_KEY,
        controller.getData,
      );

      expect(metadata).toBe(PermissionMatchMode.ANY);
    });

    it('should work with empty permissions array', () => {
      @Controller()
      class TestController {
        @RequirePermissions([])
        @Get()
        getPublic() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(PERMISSIONS_KEY, controller.getPublic);

      expect(metadata).toEqual([]);
    });
  });

  describe('Decorator Application', () => {
    it('should work on different HTTP methods', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read'])
        @Get()
        getKnowledge() {
          return 'read';
        }

        @RequirePermissions(['knowledge:create'])
        @Get()
        createKnowledge() {
          return 'create';
        }
      }

      const controller = new TestController();
      const getMetadata = reflector.get(
        PERMISSIONS_KEY,
        controller.getKnowledge,
      );
      const createMetadata = reflector.get(
        PERMISSIONS_KEY,
        controller.createKnowledge,
      );

      expect(getMetadata).toEqual(['knowledge:read']);
      expect(createMetadata).toEqual(['knowledge:create']);
    });

    it('should not interfere with other decorators', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['knowledge:read'])
        @Get('test')
        getKnowledge() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(
        PERMISSIONS_KEY,
        controller.getKnowledge,
      );

      expect(metadata).toEqual(['knowledge:read']);
      // The @Get decorator should still work normally
      expect(controller.getKnowledge).toBeDefined();
    });
  });

  describe('Permission Match Modes', () => {
    it('should support ALL mode (default)', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['perm1', 'perm2'])
        @Get()
        handler() {
          return 'data';
        }
      }

      const controller = new TestController();
      const mode = reflector.get(
        PERMISSION_MATCH_MODE_KEY,
        controller.handler,
      );

      expect(mode).toBe(PermissionMatchMode.ALL);
    });

    it('should support ANY mode (explicit)', () => {
      @Controller()
      class TestController {
        @RequirePermissions(['perm1', 'perm2'], {
          mode: PermissionMatchMode.ANY,
        })
        @Get()
        handler() {
          return 'data';
        }
      }

      const controller = new TestController();
      const mode = reflector.get(
        PERMISSION_MATCH_MODE_KEY,
        controller.handler,
      );

      expect(mode).toBe(PermissionMatchMode.ANY);
    });
  });
});

