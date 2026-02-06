import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// Database configuration constants (OWASP: Magic Numbers)
const DEFAULT_DB_PORT = 5432;
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Database Configuration
 *
 * Loads and validates PostgreSQL with pgvector database configuration from environment variables.
 *
 * Environment variables:
 * - DB_HOST: Database host (default: 'localhost')
 * - DB_PORT: Database port (default: 5432)
 * - DB_USERNAME: Database user (default: 'context_ai_user')
 * - DB_PASSWORD: Database password (default: 'context_ai_pass')
 * - DB_DATABASE: Database name (default: 'context_ai_db')
 * - DB_POOL_SIZE: Connection pool size (default: 10)
 * - DB_SYNCHRONIZE: Auto-sync schema (default: false, ⚠️ NEVER true in production)
 * - DB_LOGGING: Enable SQL logging (default: false)
 * - NODE_ENV: Application environment
 *
 * Features:
 * - PostgreSQL with pgvector extension for vector similarity search
 * - Connection pooling
 * - Auto-load entities from modules
 * - Synchronization disabled by default (use migrations)
 * - SSL support for production
 */
export default registerAs('database', (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || String(DEFAULT_DB_PORT), 10),
    username: process.env.DB_USERNAME || 'context_ai_user',
    password: process.env.DB_PASSWORD || 'context_ai_pass',
    database: process.env.DB_DATABASE || 'context_ai_db',

    // Entity patterns to load (includes both .entity.ts and .model.ts files)
    entities: [
      __dirname + '/../**/*.entity{.ts,.js}',
      __dirname + '/../**/*.model{.ts,.js}',
    ],

    // Migrations
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: false, // Run migrations manually for safety

    // Connection pool
    poolSize: parseInt(
      process.env.DB_POOL_SIZE || String(DEFAULT_POOL_SIZE),
      10,
    ),

    // Connection options
    connectTimeoutMS: DEFAULT_CONNECTION_TIMEOUT_MS,
    extra: {
      max: parseInt(process.env.DB_POOL_SIZE || String(DEFAULT_POOL_SIZE), 10),
    },

    // Synchronization (⚠️ NEVER true in production - use migrations instead)
    synchronize: process.env.DB_SYNCHRONIZE === 'true' && !isProduction,

    // Logging
    logging: process.env.DB_LOGGING === 'true' && !isProduction,

    // Auto-load entities from modules
    autoLoadEntities: true,

    // SSL configuration for production
    ssl: isProduction
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  };
});
