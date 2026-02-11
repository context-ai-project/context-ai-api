import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RequireRoles,
  ROLES_KEY,
} from '../../../../../src/modules/auth/decorators/require-roles.decorator';

describe('RequireRoles Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('Metadata Setting', () => {
    it('should set roles metadata on the handler', () => {
      @Controller()
      class TestController {
        @RequireRoles('admin')
        @Get()
        getAdminData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getAdminData);

      expect(metadata).toEqual(['admin']);
    });

    it('should set multiple roles', () => {
      @Controller()
      class TestController {
        @RequireRoles('admin', 'manager')
        @Get()
        getAdminData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getAdminData);

      expect(metadata).toEqual(['admin', 'manager']);
    });

    it('should work with empty roles', () => {
      @Controller()
      class TestController {
        @RequireRoles()
        @Get()
        getPublic() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getPublic);

      expect(metadata).toEqual([]);
    });
  });

  describe('Decorator Application', () => {
    it('should work on different HTTP methods', () => {
      @Controller()
      class TestController {
        @RequireRoles('admin')
        @Get()
        getAdminData() {
          return 'read';
        }

        @RequireRoles('manager')
        @Get()
        getManagerData() {
          return 'manage';
        }
      }

      const controller = new TestController();
      const adminMetadata = reflector.get(ROLES_KEY, controller.getAdminData);
      const managerMetadata = reflector.get(
        ROLES_KEY,
        controller.getManagerData,
      );

      expect(adminMetadata).toEqual(['admin']);
      expect(managerMetadata).toEqual(['manager']);
    });

    it('should not interfere with other decorators', () => {
      @Controller()
      class TestController {
        @RequireRoles('admin')
        @Get('admin')
        getAdminData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getAdminData);

      expect(metadata).toEqual(['admin']);
      // The @Get decorator should still work normally
      expect(controller.getAdminData).toBeDefined();
    });
  });

  describe('Role Combinations', () => {
    it('should support single role', () => {
      @Controller()
      class TestController {
        @RequireRoles('user')
        @Get()
        getUserData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getUserData);

      expect(metadata).toEqual(['user']);
      expect(metadata).toHaveLength(1);
    });

    it('should support multiple roles (OR logic)', () => {
      @Controller()
      class TestController {
        @RequireRoles('admin', 'manager', 'user')
        @Get()
        getAllowedData() {
          return 'data';
        }
      }

      const controller = new TestController();
      const metadata = reflector.get(ROLES_KEY, controller.getAllowedData);

      expect(metadata).toEqual(['admin', 'manager', 'user']);
      expect(metadata).toHaveLength(3);
    });
  });
});

