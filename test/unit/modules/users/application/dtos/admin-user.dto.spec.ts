import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateUserRoleDto,
  ToggleUserStatusDto,
  UpdateUserSectorsDto,
  AdminUserQueryDto,
} from '../../../../../../src/modules/users/application/dtos/admin-user.dto';

describe('Admin User DTOs', () => {
  // ── UpdateUserRoleDto ──────────────────────────────────────────────────────

  describe('UpdateUserRoleDto', () => {
    it('should validate with a valid role', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { role: 'manager' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with empty role', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { role: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when role is missing', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when role is not a string', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { role: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── ToggleUserStatusDto ────────────────────────────────────────────────────

  describe('ToggleUserStatusDto', () => {
    it('should validate with true', async () => {
      const dto = plainToInstance(ToggleUserStatusDto, { isActive: true });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with false', async () => {
      const dto = plainToInstance(ToggleUserStatusDto, { isActive: false });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when isActive is not a boolean', async () => {
      const dto = plainToInstance(ToggleUserStatusDto, { isActive: 'yes' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── UpdateUserSectorsDto ───────────────────────────────────────────────────

  describe('UpdateUserSectorsDto', () => {
    it('should validate with valid UUIDs', async () => {
      const dto = plainToInstance(UpdateUserSectorsDto, {
        sectorIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with empty array', async () => {
      const dto = plainToInstance(UpdateUserSectorsDto, { sectorIds: [] });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with invalid UUIDs', async () => {
      const dto = plainToInstance(UpdateUserSectorsDto, {
        sectorIds: ['not-a-uuid'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when sectorIds is not an array', async () => {
      const dto = plainToInstance(UpdateUserSectorsDto, {
        sectorIds: 'single-id',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── AdminUserQueryDto ──────────────────────────────────────────────────────

  describe('AdminUserQueryDto', () => {
    it('should validate without search', async () => {
      const dto = plainToInstance(AdminUserQueryDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with search string', async () => {
      const dto = plainToInstance(AdminUserQueryDto, { search: 'john' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when search is not a string', async () => {
      const dto = plainToInstance(AdminUserQueryDto, { search: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

