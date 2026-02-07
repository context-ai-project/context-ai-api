/**
 * Jest Setup for E2E Tests
 *
 * This file runs before all E2E tests to set up the testing environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for testing

// Database configuration (same as integration tests)
process.env.DATABASE_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.TEST_DB_PORT || '5433';
process.env.DATABASE_USER = process.env.TEST_DB_USERNAME || 'contextai_user';
process.env.DATABASE_PASSWORD = process.env.TEST_DB_PASSWORD || 'dev_password';
process.env.DATABASE_NAME = process.env.TEST_DB_DATABASE || 'contextai';

// Set test API keys (use dummy values for tests)
process.env.GOOGLE_API_KEY =
  process.env.GOOGLE_API_KEY || 'test-api-key';

// Increase timeout for E2E tests (they can be slower)
jest.setTimeout(30000);

// Log test environment info
console.log('\n🚀 E2E Test Environment:');
console.log(`   Port: ${process.env.PORT}`);
console.log(`   Database: ${process.env.DATABASE_NAME}`);
console.log(
  `   Host: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`,
);
console.log('');
