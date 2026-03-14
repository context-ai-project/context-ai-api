import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Auth0ManagementService } from '../../../../../../src/modules/invitations/infrastructure/auth0/auth0-management.service';

jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    users: {
      create: jest.fn(),
    },
  })),
  AuthenticationClient: jest.fn().mockImplementation(() => ({
    database: {
      changePassword: jest.fn(),
    },
  })),
}));

describe('Auth0ManagementService', () => {
  let service: Auth0ManagementService;
  let managementCreate: jest.Mock;
  let authChangePassword: jest.Mock;

  beforeEach(async () => {
    const { ManagementClient, AuthenticationClient } = jest.requireMock('auth0');

    managementCreate = jest.fn();
    authChangePassword = jest.fn();

    ManagementClient.mockImplementation(() => ({
      users: { create: managementCreate },
    }));
    AuthenticationClient.mockImplementation(() => ({
      database: { changePassword: authChangePassword },
    }));

    const configValues: Record<string, string> = {
      AUTH0_MGMT_DOMAIN: 'test.auth0.com',
      AUTH0_MGMT_CLIENT_ID: 'client-id',
      AUTH0_MGMT_CLIENT_SECRET: 'client-secret',
      AUTH0_DB_CONNECTION: 'test-connection',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0ManagementService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const value = configValues[key];
              if (!value) throw new Error(`Missing ${key}`);
              return value;
            }),
            get: jest.fn(
              (key: string, defaultVal?: string) =>
                configValues[key] ?? defaultVal,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<Auth0ManagementService>(Auth0ManagementService);
  });

  describe('createUser', () => {
    it('should create user and return userId', async () => {
      managementCreate.mockResolvedValue({ user_id: 'auth0|123' });

      const result = await service.createUser({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result).toEqual({ userId: 'auth0|123' });
      expect(managementCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          connection: 'test-connection',
        }),
      );
    });

    it('should throw when Auth0 returns no user_id', async () => {
      managementCreate.mockResolvedValue({});

      await expect(
        service.createUser({ email: 'test@example.com', name: 'Test' }),
      ).rejects.toThrow('Failed to create user in Auth0');
    });

    it('should throw when Auth0 SDK throws', async () => {
      managementCreate.mockRejectedValue(new Error('Auth0 API error'));

      await expect(
        service.createUser({ email: 'test@example.com', name: 'Test' }),
      ).rejects.toThrow('Failed to create user in Auth0: Auth0 API error');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      authChangePassword.mockResolvedValue(undefined);

      await expect(
        service.sendPasswordResetEmail({ email: 'test@example.com' }),
      ).resolves.not.toThrow();

      expect(authChangePassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        connection: 'test-connection',
      });
    });

    it('should throw when password reset fails', async () => {
      authChangePassword.mockRejectedValue(new Error('Reset failed'));

      await expect(
        service.sendPasswordResetEmail({ email: 'test@example.com' }),
      ).rejects.toThrow('Failed to send password reset email: Reset failed');
    });
  });
});
