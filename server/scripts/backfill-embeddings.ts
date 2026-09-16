import { db } from '../src/db/index.js';
import { memories, DEFAULT_EMBEDDING_MODEL_VERSION } from '../src/db/schema/index.js';
import { eq, or, isNull, ne, and, sql } from 'drizzle-orm';
import { getAiProvider } from '../src/services/ai/core/factory.js';
import { logger } from '../src/utils/logger.js';
import { toError } from '../src/utils/errors.js';

interface BackfillOptions {
  targetModelVersion?: string;
  batchSize?: number;
  dryRun?: boolean;
}

export async function backfillEmbeddings(options: BackfillOptions = {}) {
  const targetVersion = options.targetModelVersion || DEFAULT_EMBEDDING_MODEL_VERSION;
  const batchSize = options.batchSize || 50;
  const dryRun = Boolean(options.dryRun);

  logger.info({ targetVersion, batchSize, dryRun }, '🔄 Starting Semantic Memory Embedding Backfill & Migration');

  const provider = getAiProvider();
  if (!provider || !provider.isAvailable()) {
    throw new Error('AI Provider is not available. Please verify GEMINI_API_KEY.');
  }

  // 1. Identify stale or missing embeddings
  const pendingRows = await db
    .select({
      id: memories.id,
      userId: memories.userId,
      content: memories.content,
      type: memories.type,
      currentVersion: memories.embeddingModelVersion,
    })
    .from(memories)
    .where(
      and(
        eq(memories.status, 'active'),
        or(isNull(memories.embedding), ne(memories.embeddingModelVersion, targetVersion)),
      ),
    )
    .limit(500);

  logger.info({ count: pendingRows.length }, '📊 Found memories requiring embedding update');

  if (pendingRows.length === 0) {
    logger.info('✅ All active memories are up-to-date with target embedding model version.');
    return { updatedCount: 0, totalPending: 0 };
  }

  if (dryRun) {
    logger.info({ sample: pendingRows.slice(0, 3) }, '🔍 Dry run mode: no changes committed.');
    return { updatedCount: 0, totalPending: pendingRows.length };
  }

  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pendingRows.length; i += batchSize) {
    const chunk = pendingRows.slice(i, i + batchSize);
    logger.info({ batchIndex: Math.floor(i / batchSize) + 1, batchCount: chunk.length }, 'Processing batch...');

    for (const row of chunk) {
      try {
        const embedding = await provider.generateEmbedding(row.content, { dimensions: 768 });
        await db
          .update(memories)
          .set({
            embedding,
            embeddingModelVersion: targetVersion,
            updatedAt: new Date(),
          })
          .where(eq(memories.id, row.id));

        updatedCount++;
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        logger.warn({ memoryId: row.id, err: err.message }, 'Failed to generate embedding for memory row');
        failedCount++;
      }
    }
  }

  logger.info({ updatedCount, failedCount, targetVersion }, '🎉 Memory Embedding Migration & Backfill Completed');

  return { updatedCount, failedCount, totalPending: pendingRows.length };
}

// CLI runner when executed directly
if (process.argv[1]?.endsWith('backfill-embeddings.ts') || process.argv[1]?.endsWith('backfill-embeddings.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetVersionArg = args.find((a) => a.startsWith('--target='))?.split('=')[1];

  backfillEmbeddings({ dryRun, targetModelVersion: targetVersionArg })
    .then((res) => {
      logger.info(res, 'Backfill script finished cleanly');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Fatal error during backfill script');
      process.exit(1);
    });
}
