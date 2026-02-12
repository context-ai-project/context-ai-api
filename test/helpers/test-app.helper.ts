/**
 * Test App Helper
 *
 * Manages the lifecycle of a NestJS test application for E2E tests.
 * Provides a consistent way to create, configure, and tear down
 * test applications.
 *
 * Phase 7.2: E2E Test Helpers and Utilities
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export class TestAppHelper {
  private app: INestApplication | null = null;
  private moduleRef: TestingModule | null = null;
  private dataSource: DataSource | null = null;

  /**
   * Create and initialize a full NestJS test application.
   * Applies the same global configuration as main.ts.
   */
  async createTestApp(): Promise<INestApplication> {
    this.moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.moduleRef.createNestApplication();

    // Apply same pipes as production
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await this.app.init();

    this.dataSource = this.moduleRef.get<DataSource>(DataSource);

    return this.app;
  }

  /**
   * Get the current NestJS application instance.
   */
  getApp(): INestApplication {
    if (!this.app) {
      throw new Error(
        'TestAppHelper: App not initialized. Call createTestApp() first.',
      );
    }
    return this.app;
  }

  /**
   * Get the HTTP server for supertest requests.
   */
  getHttpServer(): ReturnType<INestApplication['getHttpServer']> {
    return this.getApp().getHttpServer();
  }

  /**
   * Get the TypeORM DataSource for direct database operations.
   */
  getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Error(
        'TestAppHelper: DataSource not available. Call createTestApp() first.',
      );
    }
    return this.dataSource;
  }

  /**
   * Get a provider from the NestJS DI container.
   */
  /**
   * Get a provider from the NestJS DI container by class, string token, or symbol.
   */
  get<T>(token: { new (...args: unknown[]): T } | string | symbol): T {
    if (!this.moduleRef) {
      throw new Error(
        'TestAppHelper: Module not initialized. Call createTestApp() first.',
      );
    }

    if (typeof token === 'string' || typeof token === 'symbol') {
      return this.moduleRef.get<T>(token);
    }

    return this.moduleRef.get<T>(token);
  }

  /**
   * Safely close the test application and database connections.
   */
  async closeApp(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
    if (this.app) {
      await this.app.close();
    }
    this.app = null;
    this.moduleRef = null;
    this.dataSource = null;
  }
}

