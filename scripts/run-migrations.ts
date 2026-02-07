#!/usr/bin/env ts-node
/**
 * Script to run TypeORM migrations
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  username: process.env.DB_USERNAME || 'context_ai_user',
  password: process.env.DB_PASSWORD || 'context_ai_pass',
  database: process.env.DB_DATABASE || 'context_ai_db',
  entities: ['src/**/*.model.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});

async function runMigrations() {
  try {
    console.log('🔄 Initializing database connection...');
    await dataSource.initialize();
    console.log('✅ Database connected');

    console.log('\n🔄 Running migrations...');
    const migrations = await dataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    }

    await dataSource.destroy();
    console.log('\n✅ Migration process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error running migrations:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run migrations
runMigrations();

