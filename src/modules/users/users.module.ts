import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModel } from './infrastructure/persistence/models/user.model';
import { UserRepository } from './infrastructure/persistence/repositories/user.repository';
import { UserService } from './application/services/user.service';
import { UserController } from './api/controllers/user.controller';

/**
 * Users Module
 *
 * Handles user management and Auth0 synchronization
 *
 * Features:
 * - User synchronization from Auth0
 * - User lookup by Auth0 sub or email
 * - Last login tracking
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserModel])],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService, UserRepository],
})
export class UsersModule {}
