/**
 * Database Cleaner Utility
 *
 * Provides utilities for cleaning test data between test runs.
 * Ensures deterministic and isolated test execution.
 *
 * Phase 7.10: Test Data Management
 */

import { DataSource } from 'typeorm';

/**
 * Table truncation order (respects foreign key constraints).
 * Tables are listed from leaf → root to avoid FK violations.
 */
const TRUNCATION_ORDER = [
  'messages',
  'conversations',
  'fragments',
  'knowledge_sources',
  'audit_logs',
  'user_roles',
  'role_permissions',
  'users',
  'permissions',
  'roles',
] as const;

export class DatabaseCleaner {
  /**
   * Truncate all application tables using CASCADE.
   * Temporarily disables FK checks for safety.
   */
  static async cleanAll(dataSource: DataSource): Promise<void> {
    if (!dataSource.isInitialized) return;

    try {
      await dataSource.query('SET session_replication_role = replica;');

      for (const table of TRUNCATION_ORDER) {
        await dataSource.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      }

      await dataSource.query('SET session_replication_role = DEFAULT;');
    } catch (error: unknown) {
      // Re-enable FK checks even if truncation fails
      await dataSource
        .query('SET session_replication_role = DEFAULT;')
        .catch(() => {
          /* ignore nested error */
        });

      const msg =
        error instanceof Error ? error.message : 'Unknown cleanup error';
      throw new Error(`DatabaseCleaner.cleanAll failed: ${msg}`);
    }
  }

  /**
   * Truncate a specific table.
   */
  static async cleanTable(
    dataSource: DataSource,
    tableName: string,
  ): Promise<void> {
    if (!dataSource.isInitialized) return;
    await dataSource.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
  }

  /**
   * Clean only knowledge-related tables.
   */
  static async cleanKnowledge(dataSource: DataSource): Promise<void> {
    if (!dataSource.isInitialized) return;

    await dataSource.query('SET session_replication_role = replica;');
    await dataSource.query('TRUNCATE fragments, knowledge_sources CASCADE;');
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }

  /**
   * Clean only interaction-related tables.
   */
  static async cleanInteractions(dataSource: DataSource): Promise<void> {
    if (!dataSource.isInitialized) return;

    await dataSource.query('SET session_replication_role = replica;');
    await dataSource.query('TRUNCATE messages, conversations CASCADE;');
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }
}

