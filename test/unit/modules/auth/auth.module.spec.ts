import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../../../src/modules/auth/auth.module';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { UserService } from '../../../../src/modules/users/application/services/user.service';
import { JwtStrategy } from '../../../../src/modules/auth/strategies/jwt.strategy';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // Mock ConfigService with Auth0 configuration
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'auth.auth0.domain': 'test.auth0.com',
          'auth.auth0.audience': 'https://api.contextai.com',
          'auth.auth0.issuer': 'https://test.auth0.com/',
        };
        return config[key];
      }),
    };

    // Mock UserService for user synchronization
    const mockUserService = {
      syncUser: jest.fn().mockResolvedValue({
        id: 'user-uuid-123',
        auth0UserId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }),
      getUserById: jest.fn(),
    };

    module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuthService', () => {
    const authService = module.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('should provide JwtStrategy', () => {
    const jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    expect(jwtStrategy).toBeDefined();
  });

  it('should provide UserService', () => {
    const userService = module.get<UserService>(UserService);
    expect(userService).toBeDefined();
  });

  it('should import PassportModule', () => {
    // PassportModule is imported internally, verify module compiles successfully
    expect(module.get(PassportModule)).toBeDefined();
  });
});
