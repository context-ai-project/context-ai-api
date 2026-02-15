import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../../../src/modules/auth/auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuth0Config', () => {
    it('should return full Auth0 config when all values are configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')           // domain
        .mockReturnValueOnce('https://api.contextai.com') // audience
        .mockReturnValueOnce('https://test.auth0.com/');  // issuer

      const config = service.getAuth0Config();

      expect(config).toEqual({
        domain: 'test.auth0.com',
        audience: 'https://api.contextai.com',
        issuer: 'https://test.auth0.com/',
      });
    });

    it('should throw error when domain is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.getAuth0Config()).toThrow('AUTH0_DOMAIN is not configured');
    });

    it('should throw error when audience is not configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')  // domain
        .mockReturnValueOnce(undefined);        // audience missing

      expect(() => service.getAuth0Config()).toThrow('AUTH0_AUDIENCE is not configured');
    });

    it('should throw error when issuer is not configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')            // domain
        .mockReturnValueOnce('https://api.contextai.com') // audience
        .mockReturnValueOnce(undefined);                  // issuer missing

      expect(() => service.getAuth0Config()).toThrow('AUTH0_ISSUER is not configured');
    });
  });

  describe('getAuth0Domain', () => {
    it('should return Auth0 domain when configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')
        .mockReturnValueOnce('https://api.contextai.com')
        .mockReturnValueOnce('https://test.auth0.com/');

      const result = service.getAuth0Domain();

      expect(result).toBe('test.auth0.com');
    });

    it('should throw error when Auth0 domain is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.getAuth0Domain()).toThrow('AUTH0_DOMAIN is not configured');
    });
  });

  describe('getAuth0Audience', () => {
    it('should return Auth0 audience when configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')
        .mockReturnValueOnce('https://api.contextai.com')
        .mockReturnValueOnce('https://test.auth0.com/');

      const result = service.getAuth0Audience();

      expect(result).toBe('https://api.contextai.com');
    });

    it('should throw error when Auth0 audience is not configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')
        .mockReturnValueOnce(undefined);

      expect(() => service.getAuth0Audience()).toThrow('AUTH0_AUDIENCE is not configured');
    });
  });

  describe('getAuth0Issuer', () => {
    it('should return Auth0 issuer when configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')
        .mockReturnValueOnce('https://api.contextai.com')
        .mockReturnValueOnce('https://test.auth0.com/');

      const result = service.getAuth0Issuer();

      expect(result).toBe('https://test.auth0.com/');
    });

    it('should throw error when Auth0 issuer is not configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com')
        .mockReturnValueOnce('https://api.contextai.com')
        .mockReturnValueOnce(undefined);

      expect(() => service.getAuth0Issuer()).toThrow('AUTH0_ISSUER is not configured');
    });
  });

  describe('validateConfiguration', () => {
    it('should not throw error when all configuration is present', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com') // domain
        .mockReturnValueOnce('https://api.contextai.com') // audience
        .mockReturnValueOnce('https://test.auth0.com/'); // issuer

      expect(() => service.validateConfiguration()).not.toThrow();
    });

    it('should throw error when domain is missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.validateConfiguration()).toThrow('AUTH0_DOMAIN is not configured');
    });

    it('should throw error when audience is missing', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com') // domain
        .mockReturnValueOnce(undefined); // audience

      expect(() => service.validateConfiguration()).toThrow('AUTH0_AUDIENCE is not configured');
    });

    it('should throw error when issuer is missing', () => {
      mockConfigService.get
        .mockReturnValueOnce('test.auth0.com') // domain
        .mockReturnValueOnce('https://api.contextai.com') // audience
        .mockReturnValueOnce(undefined); // issuer

      expect(() => service.validateConfiguration()).toThrow('AUTH0_ISSUER is not configured');
    });
  });
});
