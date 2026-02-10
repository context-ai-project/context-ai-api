import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Auth Module
 *
 * Handles authentication and authorization for the application.
 *
 * Features:
 * - JWT token validation with Auth0 via Passport
 * - JWKS (JSON Web Key Set) integration
 * - Role-Based Access Control (RBAC)
 * - Permission guards and decorators
 *
 * Dependencies:
 * - @nestjs/passport: Passport.js integration
 * - passport-jwt: JWT authentication strategy
 * - jwks-rsa: Public key validation from Auth0 JWKS
 *
 * Phase 6 Implementation:
 * - Issue 6.2: Module structure ✅
 * - Issue 6.3: JWT Strategy (pending)
 * - Issue 6.4: Auth Guard (pending)
 * - Issue 6.5: Current User Decorator (pending)
 * - Issue 6.10: RBAC Guard (pending)
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule, // For accessing Auth0 configuration
  ],
  providers: [
    AuthService,
    JwtStrategy, // JWT authentication strategy
  ],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
