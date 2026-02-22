import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModel } from './infrastructure/persistence/models/user.model';
import { UserRepository } from './infrastructure/persistence/repositories/user.repository';
import { UserService } from './application/services/user.service';
import { AdminUserService } from './application/services/admin-user.service';
import { UserController } from './api/controllers/user.controller';
import { AdminUserController } from './api/controllers/admin-user.controller';
import { AuthModule } from '../auth/auth.module';
import { SectorsModule } from '../sectors/sectors.module';

/**
 * Users Module
 *
 * Handles user management and Auth0 synchronization
 *
 * Features:
 * - User synchronization from Auth0
 * - User lookup by Auth0 sub or email
 * - Last login tracking
 * - Admin: user listing, role management, status toggling, sector assignment
 * - v1.3: Invitation acceptance on first login (via IInvitationAcceptanceService)
 *
 * Dependencies:
 * - AuthModule (forwardRef): Provides InternalApiKeyGuard, RoleRepository for /users/sync endpoint.
 *   Uses forwardRef to resolve circular dependency (AuthModule → UsersModule → AuthModule).
 *   RoleRepository is used by UserService to assign roles during invitation acceptance.
 * - SectorsModule: Provides ISectorRepository for sector validation in admin operations.
 *
 * Note: IInvitationAcceptanceService is provided as null by default.
 * When InvitationsModule is loaded, it overrides this with the real InvitationService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserModel]),
    forwardRef(() => AuthModule), // For InternalApiKeyGuard (circular dep with AuthModule)
    SectorsModule, // For ISectorRepository (admin sector assignment)
  ],
  controllers: [UserController, AdminUserController],
  providers: [
    UserRepository,
    UserService,
    AdminUserService,
    // Default null provider for IInvitationAcceptanceService
    // Overridden by InvitationsModule when loaded
    {
      provide: 'IInvitationAcceptanceService',
      useValue: null,
    },
  ],
  exports: [UserService, UserRepository],
})
export class UsersModule {}
