import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Database Configuration
 *
 * Loads and validates PostgreSQL database configuration from environment variables
 *
 * @returns TypeORM configuration object with database settings:
 * - type: Database type (postgres)
 * - host: Database host (default: 'localhost')
 * - port: Database port (default: 5432)
 * - username: Database user (default: 'contextai_user')
 * - password: Database password (default: 'dev_password')
 * - database: Database name (default: 'contextai')
 * - entities: Entity patterns to load
 * - synchronize: Auto-sync schema (⚠️ only in development)
 * - logging: Enable SQL logging (only in development)
 * - autoLoadEntities: Automatically load entities from modules
 */
export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'contextai_user',
    password: process.env.DATABASE_PASSWORD || 'dev_password',
    database: process.env.DATABASE_NAME || 'contextai',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development', // ⚠️ Solo en desarrollo
    logging: process.env.NODE_ENV === 'development',
    autoLoadEntities: true,
  }),
);
