import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { testDbConfig } from './test-db.config';

/**
 * Integration Test Helpers
 *
 * Provides utilities for setting up and tearing down integration tests
 * that require a real database connection.
 */

/**
 * Creates a TypeORM testing module with real database connection
 *
 * @param entities - Array of TypeORM entities to register
 * @param providers - Array of providers to register
 * @returns TestingModule instance
 */
export async function createTestingModule(
  entities: unknown[],
  providers: unknown[],
): Promise<TestingModule> {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(testDbConfig),
      TypeOrmModule.forFeature(entities as never[]),
    ],
    providers: providers as never[],
  }).compile();

  return module;
}

/**
 * Cleans up database after tests
 *
 * @param dataSource - TypeORM DataSource instance
 */
export async function cleanupDatabase(dataSource: DataSource): Promise<void> {
  if (!dataSource.isInitialized) {
    return;
  }

  try {
    // Get all table names
    const entities = dataSource.entityMetadatas;

    // Disable foreign key checks temporarily
    await dataSource.query('SET session_replication_role = replica;');

    // Truncate all tables
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.clear();
    }

    // Re-enable foreign key checks
    await dataSource.query('SET session_replication_role = DEFAULT;');
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to cleanup database: ${errorMessage}`);
  }
}

/**
 * Closes database connection
 *
 * @param dataSource - TypeORM DataSource instance (optional)
 */
export async function closeDatabase(dataSource?: DataSource): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

/**
 * Waits for database to be ready
 *
 * @param dataSource - TypeORM DataSource instance
 * @param maxRetries - Maximum number of retries (default: 10)
 * @param delayMs - Delay between retries in milliseconds (default: 1000)
 */
export async function waitForDatabase(
  dataSource: DataSource,
  maxRetries = 10,
  delayMs = 1000,
): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      await dataSource.query('SELECT 1');
      return;
    } catch (error: unknown) {
      retries++;
      if (retries >= maxRetries) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Database not ready after ${maxRetries} retries: ${errorMessage}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Creates a test UUID
 *
 * @param prefix - Optional prefix for the UUID (not recommended, generates invalid UUID)
 * @returns UUID string in format xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx
 */
export function createTestUuid(prefix = ''): string {
  if (prefix) {
    // If prefix is provided, generate a deterministic UUID-like string
    // Note: This will not be a valid UUID v4 but is useful for testing
    const hash = prefix.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const hex = Math.abs(hash).toString(16).padEnd(32, '0').substring(0, 32);
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
  }

  // Generate a proper UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a test date
 *
 * @param daysAgo - Number of days ago (default: 0 = today)
 * @returns Date object
 */
export function createTestDate(daysAgo = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}
