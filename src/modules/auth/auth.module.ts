import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RBACGuard } from './guards/rbac.guard';
import { UsersModule } from '../users/users.module';
import { RoleModel } from './infrastructure/persistence/models/role.model';
import { PermissionModel } from './infrastructure/persistence/models/permission.model';
import { RoleRepository } from './infrastructure/persistence/repositories/role.repository';
import { PermissionRepository } from './infrastructure/persistence/repositories/permission.repository';
import { PermissionService } from './application/services/permission.service';
import { RbacSeederService } from './application/services/rbac-seeder.service';
import { TokenRevocationService } from './application/services/token-revocation.service';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

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
 * - Issue 6.7: Add Auth to Controllers ✅
 * - Issue 6.8: Role & Permission Models ✅
 * - Issue 6.9: Permission Decorators ✅
 * - Issue 6.10: RBAC Guard ✅
 * - Issue 6.11: Permission Service ✅
 * - Issue 6.12: Permissions Seeder ✅
 * - Issue 6.13: Token Revocation ✅
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule, // For accessing Auth0 configuration
    TypeOrmModule.forFeature([RoleModel, PermissionModel]), // RBAC entities
    forwardRef(() => UsersModule), // For user synchronization (forwardRef: circular dep)
  ],
  providers: [
    AuthService,
    JwtStrategy, // JWT authentication strategy
    JwtAuthGuard, // JWT authentication guard
    RBACGuard, // RBAC authorization guard
    RoleRepository, // Role data access
    PermissionRepository, // Permission data access
    PermissionService, // RBAC logic
    RbacSeederService, // RBAC seeder for initializing data
    TokenRevocationService, // Token revocation for immediate logout
    InternalApiKeyGuard, // Guard for server-to-server bootstrap endpoints
  ],
  exports: [
    AuthService,
    PassportModule,
    JwtAuthGuard,
    RBACGuard, // Export for use in controllers
    PermissionService, // Export for use in other modules
    RbacSeederService, // Export for use in CLI commands
    TokenRevocationService, // Export for use in other modules (e.g., admin endpoints)
    InternalApiKeyGuard, // Export for use in other modules (e.g., users/sync)
  ],
})
export class AuthModule {}
