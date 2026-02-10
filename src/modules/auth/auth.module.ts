import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersModule } from '../users/users.module';
import { RoleModel } from './infrastructure/persistence/models/role.model';
import { PermissionModel } from './infrastructure/persistence/models/permission.model';
import { RoleRepository } from './infrastructure/persistence/repositories/role.repository';
import { PermissionRepository } from './infrastructure/persistence/repositories/permission.repository';
import { PermissionService } from './application/services/permission.service';

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
 * - Issue 6.3: JWT Strategy ✅
 * - Issue 6.4: Auth Guard ✅
 * - Issue 6.5: Current User Decorator ✅
 * - Issue 6.6: Sync User on First Login ✅
 * - Issue 6.8: Role & Permission Models ✅
 * - Issue 6.11: Permission Service ✅
 * - Issue 6.10: RBAC Guard (pending)
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule, // For accessing Auth0 configuration
    TypeOrmModule.forFeature([RoleModel, PermissionModel]), // RBAC entities
    UsersModule, // For user synchronization and repository
  ],
  providers: [
    AuthService,
    JwtStrategy, // JWT authentication strategy
    JwtAuthGuard, // JWT authentication guard
    RoleRepository, // Role data access
    PermissionRepository, // Permission data access
    PermissionService, // RBAC logic
  ],
  exports: [
    AuthService,
    PassportModule,
    JwtAuthGuard,
    PermissionService, // Export for use in other modules
  ],
})
export class AuthModule {}
