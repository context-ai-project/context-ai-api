import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModel } from './infrastructure/persistence/models/user.model';
import { UserRepository } from './infrastructure/persistence/repositories/user.repository';
import { UserService } from './application/services/user.service';
import { UserController } from './api/controllers/user.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Users Module
 *
 * Handles user management and Auth0 synchronization
 *
 * Features:
 * - User synchronization from Auth0
 * - User lookup by Auth0 sub or email
 * - Last login tracking
 *
 * Dependencies:
 * - AuthModule (forwardRef): Provides InternalApiKeyGuard for /users/sync endpoint.
 *   Uses forwardRef to resolve circular dependency (AuthModule → UsersModule → AuthModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserModel]),
    forwardRef(() => AuthModule), // For InternalApiKeyGuard (circular dep with AuthModule)
  ],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService, UserRepository],
})
export class UsersModule {}
