import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../../src/modules/auth/auth.module';
import { AuthService } from '../../../../src/modules/auth/auth.service';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule, ConfigModule.forRoot({ isGlobal: true })],
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

  it('should import PassportModule', () => {
    // PassportModule is imported internally, verify module compiles successfully
    expect(module.get(PassportModule)).toBeDefined();
  });

  it('should export AuthService', async () => {
    // Create a test module that imports AuthModule
    const testModule = await Test.createTestingModule({
      imports: [AuthModule, ConfigModule.forRoot({ isGlobal: true })],
    }).compile();

    // AuthService should be accessible from imported module
    const authService = testModule.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
  });

  it('should export PassportModule', async () => {
    // Create a test module that imports AuthModule
    const testModule = await Test.createTestingModule({
      imports: [AuthModule, ConfigModule.forRoot({ isGlobal: true })],
    }).compile();

    // PassportModule should be accessible from imported module
    expect(testModule.get(PassportModule)).toBeDefined();
  });
});

