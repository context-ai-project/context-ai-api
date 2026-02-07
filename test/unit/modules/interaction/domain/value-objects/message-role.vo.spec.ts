import {
  type MessageRole,
  MESSAGE_ROLES,
  isValidMessageRole,
  getAllMessageRoles,
} from '@modules/interaction/domain/value-objects/message-role.vo';

describe('MessageRole Value Object', () => {
  describe('MESSAGE_ROLES', () => {
    it('should have USER constant', () => {
      expect(MESSAGE_ROLES.USER).toBe('user');
    });

    it('should have ASSISTANT constant', () => {
      expect(MESSAGE_ROLES.ASSISTANT).toBe('assistant');
    });

    it('should have SYSTEM constant', () => {
      expect(MESSAGE_ROLES.SYSTEM).toBe('system');
    });
  });

  describe('isValidMessageRole', () => {
    it('should return true for valid user role', () => {
      expect(isValidMessageRole('user')).toBe(true);
    });

    it('should return true for valid assistant role', () => {
      expect(isValidMessageRole('assistant')).toBe(true);
    });

    it('should return true for valid system role', () => {
      expect(isValidMessageRole('system')).toBe(true);
    });

    it('should return false for invalid role', () => {
      expect(isValidMessageRole('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidMessageRole('')).toBe(false);
    });

    it('should return false for uppercase role', () => {
      expect(isValidMessageRole('USER')).toBe(false);
    });
  });

  describe('getAllMessageRoles', () => {
    it('should return all valid message roles', () => {
      const roles = getAllMessageRoles();
      expect(roles).toHaveLength(3);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
      expect(roles).toContain('system');
    });

    it('should return an array', () => {
      const roles = getAllMessageRoles();
      expect(Array.isArray(roles)).toBe(true);
    });
  });

  describe('Type checking', () => {
    it('should allow valid role assignment', () => {
      const role: MessageRole = 'user';
      expect(role).toBe('user');
    });

    it('should work with MESSAGE_ROLES constants', () => {
      const role: MessageRole = MESSAGE_ROLES.USER;
      expect(role).toBe('user');
    });
  });
});

