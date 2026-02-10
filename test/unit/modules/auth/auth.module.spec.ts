import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../../../../src/modules/auth/auth.module';
import { AuthService } from '../../../../src/modules/auth/auth.service';

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

    module = await Test.createTestingModule({
      imports: [AuthModule, ConfigModule.forRoot({ isGlobal: true })],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuthService', () => {
    const authService = module.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('should import PassportModule', () => {
    // PassportModule is imported internally, verify module compiles successfully
    expect(module.get(PassportModule)).toBeDefined();
  });

  it('should export AuthService', async () => {
    // AuthService should be accessible from imported module
    const authService = module.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
  });

  it('should export PassportModule', async () => {
    // PassportModule should be accessible from imported module
    expect(module.get(PassportModule)).toBeDefined();
  });
});

