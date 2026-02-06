import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { KnowledgeSourceModel } from '../../src/modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from '../../src/modules/knowledge/infrastructure/persistence/models/fragment.model';

// Test database configuration constants
const TEST_DB_PORT = 5433; // Updated to match current Docker setup
const TEST_DB_POOL_SIZE = 5;

/**
 * Test Database Configuration
 *
 * Provides TypeORM configuration for integration tests.
 * Uses the same PostgreSQL container but with a separate test database.
 *
 * Note: Tests should clean up after themselves to avoid test pollution.
 */
export const testDbConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || String(TEST_DB_PORT), 10),
  username: process.env.TEST_DB_USERNAME || 'contextai_user',
  password: process.env.TEST_DB_PASSWORD || 'dev_password',
  database: process.env.TEST_DB_DATABASE || 'contextai',

  // Entities
  entities: [KnowledgeSourceModel, FragmentModel],

  // Synchronize schema for tests
  synchronize: true,
  dropSchema: true, // Drop and recreate schema for each test suite

  // Logging
  logging: process.env.TEST_DB_LOGGING === 'true',

  // Connection pool
  poolSize: TEST_DB_POOL_SIZE,

  // Auto-load entities
  autoLoadEntities: true,
};
