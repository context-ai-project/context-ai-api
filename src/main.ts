import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

// Default configuration values
const DEFAULT_PORT = 3001;
const DEFAULT_API_PREFIX = 'api/v1';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

/**
 * Bootstrap function
 *
 * Initializes and configures the NestJS application with:
 * - Global API prefix
 * - Security headers (Helmet)
 * - CORS configuration
 * - Global validation pipes
 * - Swagger documentation
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', DEFAULT_PORT);
  const apiPrefix = configService.get<string>(
    'app.apiPrefix',
    DEFAULT_API_PREFIX,
  );
  const allowedOrigins = configService.get<string[]>(
    'app.allowedOrigins',
    DEFAULT_ALLOWED_ORIGINS,
  );

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip props that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra props
      transform: true, // Auto transform to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  setupSwagger(app, port);

  await app.listen(port);

  console.log(
    `🚀 Context.ai API running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📖 API Docs (Swagger): http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('❌ Error during application bootstrap:', error);
  process.exit(1);
});
