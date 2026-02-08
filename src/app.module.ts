import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';

// Feature Modules
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { InteractionModule } from './modules/interaction/interaction.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Application Root Module
 *
 * Orchestrates the application by importing and configuring:
 * - ConfigModule: Global configuration management
 * - TypeOrmModule: Database connection and entity management
 * - Feature modules: Domain-specific modules (to be added)
 *
 * This module follows the modular monolith architecture pattern
 */
@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
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

    // Feature Modules
    KnowledgeModule,
    InteractionModule,
    UsersModule, // User management and Auth0 sync
    // AuthModule (JWT validation - to be added in Phase 6),
    // AuthorizationModule (RBAC - to be added in Phase 6),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
