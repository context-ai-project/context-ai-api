#!/usr/bin/env tsx

/**
 * RBAC Seeder CLI Script
 *
 * Seeds roles, permissions, and role-permission associations.
 *
 * Usage:
 *   pnpm seed:rbac              # Seed RBAC data
 *   pnpm seed:rbac --clear      # Clear and re-seed RBAC data
 *
 * This script uses NestJS's standalone application to bootstrap
 * the necessary dependencies and execute the seeder service.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeederService } from '../modules/auth/application/services/rbac-seeder.service';
import { Logger } from '@nestjs/common';

const logger = new Logger('RbacSeederCLI');

async function bootstrap() {
  try {
    // Parse command-line arguments
    const shouldClear = process.argv.includes('--clear');

    logger.log('Initializing application context...');

    // Create standalone application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get seeder service
    const seederService = app.get(RbacSeederService);

    if (shouldClear) {
      logger.warn('Clearing existing RBAC data...');
      await seederService.clear();
      logger.log('RBAC data cleared successfully');
    }

    // Seed RBAC data
    logger.log('Seeding RBAC data...');
    const result = await seederService.seed();

    logger.log('RBAC seeding completed successfully:');
    logger.log(`  - Roles created: ${result.rolesCreated}`);
    logger.log(`  - Permissions created: ${result.permissionsCreated}`);
    logger.log(`  - Associations created: ${result.associationsCreated}`);

    // Close application context
    await app.close();

    process.exit(0);
  } catch (error) {
    logger.error('RBAC seeding failed:', error);
    process.exit(1);
  }
}

// Run the bootstrap function
bootstrap().catch((error) => {
  logger.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
