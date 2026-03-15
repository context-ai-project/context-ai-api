import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeVectorStore } from '../services/pinecone-vector-store.service';

/**
 * Pinecone Module
 *
 * Configures and provides the Pinecone client and PineconeVectorStore service.
 * Uses NestJS dependency injection for proper lifecycle management.
 *
 * Environment Variables Required:
 * - PINECONE_API_KEY: API key for Pinecone authentication
 * - PINECONE_INDEX: Name of the Pinecone index (default: 'context-ai')
 *
 * Exports:
 * - 'IVectorStore': PineconeVectorStore instance (bound to interface token)
 */
@Module({
  providers: [
    // Pinecone Client Provider
    {
      provide: 'PINECONE_CLIENT',
      useFactory: (configService: ConfigService): Pinecone => {
        const logger = new Logger('PineconeModule');
        const apiKey = configService.get<string>('PINECONE_API_KEY');

        if (!apiKey) {
          const isProduction =
            configService.get<string>('NODE_ENV') === 'production';
          if (isProduction) {
            throw new Error(
              'PINECONE_API_KEY is required in production. Set it in your environment variables.',
            );
          }
          logger.warn(
            'PINECONE_API_KEY is not configured. Vector store operations will fail.',
          );
        }

        const client = new Pinecone({
          apiKey: apiKey ?? '',
        });

        logger.log('Pinecone client initialized');
        return client;
      },
      inject: [ConfigService],
    },

    // PineconeVectorStore Provider (bound to IVectorStore interface token)
    {
      provide: 'IVectorStore',
      useFactory: (
        pineconeClient: Pinecone,
        configService: ConfigService,
      ): PineconeVectorStore => {
        const logger = new Logger('PineconeModule');
        const indexName =
          configService.get<string>('PINECONE_INDEX') ?? 'context-ai';
        const indexHost = configService.get<string>('PINECONE_HOST');

        if (!indexHost) {
          logger.warn(
            'PINECONE_HOST is not set. The SDK will call describeIndex on every init, ' +
              'which is slower and fails if the index does not exist. ' +
              'Set PINECONE_HOST to the data-plane host shown in the Pinecone console.',
          );
        }

        return new PineconeVectorStore(pineconeClient, indexName, indexHost);
      },
      inject: ['PINECONE_CLIENT', ConfigService],
    },
  ],
  exports: ['IVectorStore'],
})
export class PineconeModule {}
