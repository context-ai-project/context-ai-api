/**
 * Jest Setup for Integration Tests
 *
 * This file runs before all integration tests to set up the testing environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || '5433';
process.env.TEST_DB_USERNAME = process.env.TEST_DB_USERNAME || 'contextai_user';
process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'dev_password';
process.env.TEST_DB_DATABASE = process.env.TEST_DB_DATABASE || 'contextai';
process.env.TEST_DB_LOGGING = process.env.TEST_DB_LOGGING || 'false';

// Set test API keys (use dummy values for tests)
process.env.GOOGLE_GENAI_API_KEY =
  process.env.GOOGLE_GENAI_API_KEY || 'test-api-key';

// Increase timeout for database operations
jest.setTimeout(30000);

// Log test environment info
console.log('\n🧪 Integration Test Environment:');
console.log(`   Database: ${process.env.TEST_DB_DATABASE}`);
console.log(`   Host: ${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}`);
console.log(`   User: ${process.env.TEST_DB_USERNAME}`);
console.log('');
