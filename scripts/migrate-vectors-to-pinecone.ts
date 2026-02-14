#!/usr/bin/env ts-node
/**
 * Data Migration Script: Migrate Vector Embeddings to Pinecone
 *
 * Phase 6B.4 - Pinecone Migration
 *
 * This script reads existing fragments from PostgreSQL, generates
 * new embeddings using Genkit (Gemini), and upserts them to Pinecone.
 *
 * Usage:
 *   npx ts-node scripts/migrate-vectors-to-pinecone.ts
 *   npx ts-node scripts/migrate-vectors-to-pinecone.ts --dry-run
 *   npx ts-node scripts/migrate-vectors-to-pinecone.ts --sector-id <uuid>
 *   npx ts-node scripts/migrate-vectors-to-pinecone.ts --dry-run --sector-id <uuid>
 *
 * Flags:
 *   --dry-run     : Preview operations without writing to Pinecone
 *   --sector-id   : Only migrate fragments from a specific sector
 *
 * Prerequisites:
 *   - PostgreSQL running with existing fragments
 *   - GOOGLE_API_KEY set in environment
 *   - PINECONE_API_KEY and PINECONE_INDEX set in environment
 *
 * IMPORTANT: Run this script BEFORE the RemovePgvectorEmbeddings migration.
 */

import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Load environment variables
dotenv.config();

// ==================== Configuration Constants ====================

const EMBEDDING_MODEL = 'googleai/gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072;
const EMBEDDING_BATCH_SIZE = 50; // Max fragments to embed at once
const PINECONE_UPSERT_BATCH_SIZE = 100; // Max vectors per Pinecone upsert
const CHARS_PER_TOKEN_ESTIMATE = 4;
const MAX_TOKEN_LIMIT = 2048;
const DB_PORT_DEFAULT = 5432;

// ==================== Types ====================

interface FragmentRow {
  id: string;
  source_id: string;
  sector_id: string;
  content: string;
  position: number;
  token_count: number;
}

interface MigrationStats {
  totalFragments: number;
  processedFragments: number;
  embeddingsGenerated: number;
  vectorsUpserted: number;
  errors: number;
  skipped: number;
}

// ==================== CLI Arguments ====================

function parseArgs(): { dryRun: boolean; sectorId: string | null } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let sectorId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      dryRun = true;
    }

    if (arg === '--sector-id' && i + 1 < args.length) {
      sectorId = args[i + 1];
      i++; // Skip next arg (the sector ID value)
    }
  }

  return { dryRun, sectorId };
}

// ==================== Database Connection ====================

function createDataSource(): DataSource {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE;

  if (!username || !password || !database) {
    throw new Error(
      'Database credentials must be set via environment variables: ' +
        'DB_USERNAME, DB_PASSWORD, DB_DATABASE. ' +
        'See env-template.txt for reference.',
    );
  }

  return new DataSource({
    type: 'postgres',
    host: host || 'localhost',
    port: parseInt(port || String(DB_PORT_DEFAULT), 10),
    username,
    password,
    database,
    synchronize: false,
    logging: false,
  });
}

// ==================== Embedding Generation ====================

function truncateText(text: string): string {
  const maxChars = MAX_TOKEN_LIMIT * CHARS_PER_TOKEN_ESTIMATE;
  if (text.length <= maxChars) return text;
  console.warn(
    `  ⚠️  Text truncated from ${text.length} to ${maxChars} characters`,
  );
  return text.substring(0, maxChars);
}

async function generateEmbeddings(
  texts: string[],
  ai: ReturnType<typeof genkit>,
): Promise<(number[] | null)[]> {
  const embeddingPromises = texts.map(async (text) => {
    const truncated = truncateText(text);
    const result = await ai.embed({
      embedder: EMBEDDING_MODEL,
      content: truncated,
      options: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'RETRIEVAL_DOCUMENT',
      },
    });

    // Genkit returns array of { embedding: number[] }
    if (Array.isArray(result) && result.length > 0 && result[0].embedding) {
      return result[0].embedding;
    } else {
      throw new Error('Invalid embedding response format');
    }
  });

  // Use Promise.allSettled to allow partial failures
  const results = await Promise.allSettled(embeddingPromises);
  return results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error(
      `    ❌ Embedding generation failed for text ${idx}: ${result.reason}`,
    );
    return null;
  });
}

// ==================== Main Migration Logic ====================

async function migrate(): Promise<void> {
  const { dryRun, sectorId } = parseArgs();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Pinecone Vector Migration Script (Phase 6B.4)  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  if (dryRun) {
    console.log('🔍 DRY RUN MODE — No data will be written to Pinecone\n');
  }

  if (sectorId) {
    console.log(`🎯 Filtering by sector: ${sectorId}\n`);
  }

  // Validate environment
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndex = process.env.PINECONE_INDEX;

  if (!googleApiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  if (!dryRun) {
    if (!pineconeApiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
    if (!pineconeIndex) {
      throw new Error('PINECONE_INDEX environment variable is required');
    }
  }

  const stats: MigrationStats = {
    totalFragments: 0,
    processedFragments: 0,
    embeddingsGenerated: 0,
    vectorsUpserted: 0,
    errors: 0,
    skipped: 0,
  };

  // Step 1: Connect to PostgreSQL
  console.log('📦 Connecting to PostgreSQL...');
  const dataSource = createDataSource();
  await dataSource.initialize();
  console.log('✅ PostgreSQL connected\n');

  // Step 2: Initialize Genkit
  console.log('🤖 Initializing Genkit AI...');
  const ai = genkit({
    plugins: [googleAI({ apiKey: googleApiKey })],
  });
  console.log('✅ Genkit AI initialized\n');

  // Step 3: Initialize Pinecone (only if not dry run)
  let pineconeNs: ReturnType<
    ReturnType<InstanceType<typeof Pinecone>['index']>['namespace']
  > | null = null;
  let pineconeClient: Pinecone | null = null;

  if (!dryRun && pineconeApiKey && pineconeIndex) {
    console.log('🌲 Connecting to Pinecone...');
    pineconeClient = new Pinecone({ apiKey: pineconeApiKey });
    console.log(`✅ Pinecone connected (index: ${pineconeIndex})\n`);
  }

  try {
    // Step 4: Query fragments from PostgreSQL
    console.log('📋 Querying fragments from PostgreSQL...');

    let query = `
      SELECT
        f.id,
        f.source_id,
        ks.sector_id,
        f.content,
        f.position,
        f.token_count
      FROM fragments f
      INNER JOIN knowledge_sources ks ON f.source_id = ks.id
      WHERE ks.status = 'COMPLETED'
        AND ks.deleted_at IS NULL
    `;

    const params: string[] = [];

    if (sectorId) {
      query += ` AND ks.sector_id = $1`;
      params.push(sectorId);
    }

    query += ` ORDER BY ks.sector_id, f.source_id, f.position`;

    const fragments: FragmentRow[] = await dataSource.query(query, params);
    stats.totalFragments = fragments.length;

    console.log(`✅ Found ${stats.totalFragments} fragments to migrate\n`);

    if (stats.totalFragments === 0) {
      console.log('ℹ️  No fragments to migrate. Exiting.');
      await dataSource.destroy();
      return;
    }

    // Step 5: Process fragments in batches
    console.log(
      `🔄 Processing in batches of ${EMBEDDING_BATCH_SIZE} (embedding) / ${PINECONE_UPSERT_BATCH_SIZE} (upsert)...\n`,
    );

    // Group fragments by sectorId for namespace-based processing
    const sectorGroups = new Map<string, FragmentRow[]>();
    for (const fragment of fragments) {
      const existing = sectorGroups.get(fragment.sector_id) ?? [];
      existing.push(fragment);
      sectorGroups.set(fragment.sector_id, existing);
    }

    console.log(`📊 Fragments grouped into ${sectorGroups.size} sector(s)\n`);

    for (const [currentSectorId, sectorFragments] of sectorGroups) {
      console.log(
        `\n━━━ Sector: ${currentSectorId} (${sectorFragments.length} fragments) ━━━`,
      );

      // Process in embedding batches
      for (
        let i = 0;
        i < sectorFragments.length;
        i += EMBEDDING_BATCH_SIZE
      ) {
        const batch = sectorFragments.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(
          sectorFragments.length / EMBEDDING_BATCH_SIZE,
        );

        console.log(
          `  📦 Batch ${batchNum}/${totalBatches} (${batch.length} fragments)`,
        );

        try {
          // Generate embeddings (partial failures are returned as null)
          console.log('    🧠 Generating embeddings...');
          const texts = batch.map((f) => f.content);
          const embeddingResults = await generateEmbeddings(texts, ai);

          // Filter out failed embeddings (null entries)
          const successfulPairs: { fragment: FragmentRow; embedding: number[] }[] = [];
          for (let k = 0; k < batch.length; k++) {
            const emb = embeddingResults[k];
            if (emb !== null) {
              successfulPairs.push({ fragment: batch[k], embedding: emb });
            }
          }

          const failedCount = batch.length - successfulPairs.length;
          stats.embeddingsGenerated += successfulPairs.length;
          stats.errors += failedCount;

          if (failedCount > 0) {
            console.warn(
              `    ⚠️  ${failedCount}/${batch.length} embeddings failed in this batch`,
            );
          }
          console.log(
            `    ✅ Generated ${successfulPairs.length} embeddings`,
          );

          if (successfulPairs.length === 0) {
            console.warn('    ⚠️  No successful embeddings — skipping upsert');
            continue;
          }

          // Prepare Pinecone vectors (only for successful embeddings)
          const vectors = successfulPairs.map(({ fragment, embedding }) => ({
            id: fragment.id,
            values: embedding,
            metadata: {
              sourceId: fragment.source_id,
              sectorId: fragment.sector_id,
              content: fragment.content,
              position: fragment.position,
              tokenCount: fragment.token_count,
            },
          }));

          if (dryRun) {
            console.log(
              `    🔍 [DRY RUN] Would upsert ${vectors.length} vectors to namespace "${currentSectorId}"`,
            );
            stats.skipped += vectors.length;
          } else if (pineconeClient && pineconeIndex) {
            // Upsert to Pinecone in sub-batches
            const index = pineconeClient.index({
              name: pineconeIndex,
            });
            pineconeNs = index.namespace(currentSectorId);

            for (
              let j = 0;
              j < vectors.length;
              j += PINECONE_UPSERT_BATCH_SIZE
            ) {
              const upsertBatch = vectors.slice(
                j,
                j + PINECONE_UPSERT_BATCH_SIZE,
              );
              await pineconeNs.upsert({
                records: upsertBatch.map((v) => ({
                  id: v.id,
                  values: v.values,
                  metadata: v.metadata as RecordMetadata,
                })),
              });
              stats.vectorsUpserted += upsertBatch.length;
            }
            console.log(
              `    ✅ Upserted ${vectors.length} vectors to Pinecone`,
            );
          }

          stats.processedFragments += successfulPairs.length;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`    ❌ Batch ${batchNum} failed: ${errorMessage}`);
          stats.errors += batch.length;

          // Continue with next batch
          continue;
        }
      }
    }

    // Step 6: Print summary
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║              Migration Summary                   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Total fragments:      ${stats.totalFragments}`);
    console.log(`  Processed:            ${stats.processedFragments}`);
    console.log(`  Embeddings generated: ${stats.embeddingsGenerated}`);
    console.log(
      `  Vectors upserted:     ${dryRun ? `${stats.skipped} (skipped - dry run)` : stats.vectorsUpserted}`,
    );
    console.log(`  Errors:               ${stats.errors}`);
    console.log();

    if (dryRun) {
      console.log(
        '🔍 DRY RUN complete. Remove --dry-run flag to perform actual migration.',
      );
    } else if (stats.errors === 0) {
      console.log(
        '✅ Migration completed successfully! You can now run the TypeORM migration:',
      );
      console.log(
        '   pnpm typeorm migration:run',
      );
    } else {
      console.log(
        `⚠️  Migration completed with ${stats.errors} errors. Review logs above.`,
      );
    }
  } finally {
    // Clean up database connection
    await dataSource.destroy();
    console.log('\n📦 Database connection closed');
  }
}

// ==================== Entry Point ====================

migrate().catch((error: unknown) => {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error';
  console.error(`\n❌ Migration failed: ${errorMessage}`);
  if (error instanceof Error && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});

