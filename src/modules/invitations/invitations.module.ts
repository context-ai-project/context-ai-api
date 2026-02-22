import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Presentation
import { InvitationController } from './presentation/invitation.controller';

// Application
import { InvitationService } from './application/invitation.service';

// Infrastructure
import { InvitationModel } from './infrastructure/persistence/models/invitation.model';
import { InvitationRepository } from './infrastructure/persistence/repositories/invitation.repository';
import { Auth0ManagementService } from './infrastructure/auth0/auth0-management.service';
import { SectorModel } from '../sectors/infrastructure/persistence/models/sector.model';

// External Dependencies
import { UsersModule } from '../users/users.module';

/**
 * Invitations Module (v1.3)
 *
 * Manages the user invitation lifecycle:
 * - Admin creates invitation → Auth0 user + emails + notification
 * - Invited user sets password → first login accepted
 *
 * Dependencies:
 * - UsersModule: UserRepository (for inviter info + email checks)
 * - SectorModel: Registered for InvitationRepository.loadSectorModels()
 *   (ManyToMany association — TypeORM access confined to infrastructure layer)
 * - ConfigModule: Environment variables (Auth0, Frontend URL)
 *
 * Note: Provides IInvitationAcceptanceService so UserService can accept
 * invitations on first login without circular dependency.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InvitationModel, SectorModel]),
    ConfigModule,
    UsersModule,
  ],
  controllers: [InvitationController],
  providers: [
    InvitationService,
    InvitationRepository,
    Auth0ManagementService,
    // Override the null default from UsersModule
    {
      provide: 'IInvitationAcceptanceService',
      useExisting: InvitationService,
    },
  ],
  exports: [InvitationService],
})
export class InvitationsModule {}
