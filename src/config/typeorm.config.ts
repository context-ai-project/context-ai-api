import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { KnowledgeSourceModel } from '../modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from '../modules/knowledge/infrastructure/persistence/models/fragment.model';
import { ConversationModel } from '../modules/interaction/infrastructure/persistence/models/conversation.model';
import { MessageModel } from '../modules/interaction/infrastructure/persistence/models/message.model';

/**
 * TypeORM Configuration
 *
 * Provides configuration for TypeORM database connection.
 * Supports both development and production environments.
 *
 * Features:
 * - PostgreSQL (vector embeddings managed externally by Pinecone)
 * - Automatic migrations
 * - Entity synchronization (development only)
 * - Connection pooling
 * - Logging (development only)
 */

// Database configuration constants
const DEFAULT_DB_PORT = 5432;
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT = 10000; // 10 seconds

/**
 * Creates TypeORM configuration from environment variables
 *
 * @param configService - NestJS ConfigService for accessing env vars
 * @returns TypeORM configuration object
 */
export const createTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get('NODE_ENV') === 'production';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', DEFAULT_DB_PORT),
    username: configService.get<string>('DB_USERNAME', 'context_ai_user'),
    password: configService.get<string>('DB_PASSWORD', 'context_ai_pass'),
    database: configService.get<string>('DB_DATABASE', 'context_ai_db'),

    // Entity models
    entities: [
      KnowledgeSourceModel,
      FragmentModel,
      ConversationModel,
      MessageModel,
    ],

    // Migrations
    migrations: ['dist/migrations/*.js'],
    migrationsRun: false, // Run migrations manually

    // Connection pool
    poolSize: configService.get<number>('DB_POOL_SIZE', DEFAULT_POOL_SIZE),

    // Connection options
    connectTimeoutMS: DEFAULT_CONNECTION_TIMEOUT,
    extra: {
      max: DEFAULT_POOL_SIZE,
    },

    // Synchronization (development only - NEVER in production)
    synchronize:
      !isProduction && configService.get<boolean>('DB_SYNCHRONIZE', false),

    // Logging (development only)
    logging: !isProduction && configService.get<boolean>('DB_LOGGING', false),

    // Auto-load entities
    autoLoadEntities: true,

    // SSL configuration for production
    ssl: isProduction
      ? {
          rejectUnauthorized: configService.get<boolean>(
            'DB_SSL_REJECT_UNAUTHORIZED',
            true,
          ),
        }
      : false,
  };
};

/**
 * TypeORM Async Configuration
 *
 * Used by NestJS to inject TypeORM with dependency injection
 */
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
    return createTypeOrmConfig(configService);
  },
};

/**
 * TypeORM CLI Configuration
 *
 * Used by TypeORM CLI for running migrations
 * Usage: npm run migration:generate -- MigrationName
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || String(DEFAULT_DB_PORT), 10),
  username: process.env.DB_USERNAME || 'context_ai_user',
  password: process.env.DB_PASSWORD || 'context_ai_pass',
  database: process.env.DB_DATABASE || 'context_ai_db',

  entities: ['src/**/*.model.ts'],
  migrations: ['src/migrations/*.ts'],

  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

// Export DataSource for TypeORM CLI
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
