import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptions,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

/**
 * Narrowed throttler configuration type.
 * Uses the object form of ThrottlerModuleOptions (with throttlers array),
 * not the flat array form, to satisfy sonarjs/function-return-type.
 */
type ThrottlerObjectConfig = Extract<
  ThrottlerModuleOptions,
  { throttlers: ThrottlerOptions[] }
>;
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import throttleConfig from './config/throttle.config';

// Feature Modules
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { InteractionModule } from './modules/interaction/interaction.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';

/**
 * Application Root Module
 *
 * Orchestrates the application by importing and configuring:
 * - ConfigModule: Global configuration management
 * - TypeOrmModule: Database connection and entity management
 * - ThrottlerModule: Rate limiting for API endpoints
 * - Feature modules: Domain-specific modules
 *
 * This module follows the modular monolith architecture pattern
 *
 * Phase 6 Implementation:
 * - Authentication & Authorization (Auth0 + JWT + RBAC) ✅
 * - Token Revocation (immediate logout) ✅
 * - Rate Limiting (DDoS protection) ✅
 */
@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, throttleConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // TypeORM Module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return configService.get('database') as TypeOrmModuleOptions;
      },
      inject: [ConfigService],
    }),

    // Rate Limiting Module (Phase 6)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): ThrottlerObjectConfig => {
        const config = configService.get<ThrottlerObjectConfig>('throttle');
        if (!config) {
          throw new Error('Throttle configuration not found');
        }
        return config;
      },
      inject: [ConfigService],
    }),

    // Feature Modules
    KnowledgeModule,
    InteractionModule,
    UsersModule, // User management and Auth0 sync
    AuthModule, // JWT validation (Phase 6)
    AuditModule, // Security audit logging (Phase 6)
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Rate Limiting Guard (Phase 6)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
