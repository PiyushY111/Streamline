import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function applyStage3Migration() {
  logger.info('🚀 Applying Stage 3 Database Migration (memories + pgvector HNSW + fulltext GIN)...');
  const sql = neon(env.DATABASE_URL);

  try {
    // 1. Ensure vector extension is present
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    logger.info('✅ Confirmed pgvector extension is active.');

    // 2. Create memories table
    logger.info('📦 Creating memories table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "memories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "content" text NOT NULL,
        "source_ref" text,
        "embedding" vector(768),
        "status" text DEFAULT 'active' NOT NULL,
        "superseded_by" uuid,
        "access_count" integer DEFAULT 0 NOT NULL,
        "last_accessed_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    logger.info('✅ memories table created or verified.');

    // 3. Create composite index on (user_id, status, type)
    logger.info('📦 Creating memories_user_status_type_idx...');
    await sql`
      CREATE INDEX IF NOT EXISTS "memories_user_status_type_idx" 
      ON "memories" ("user_id", "status", "type");
    `;

    // 4. Create HNSW index for cosine distance
    logger.info('⚡ Creating HNSW cosine distance vector index memories_embedding_hnsw_idx...');
    await sql`
      CREATE INDEX IF NOT EXISTS "memories_embedding_hnsw_idx" 
      ON "memories" 
      USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `;
    logger.info('✅ HNSW vector index created or verified.');

    // 5. Create GIN full-text index for sparse keyword search
    logger.info('🔍 Creating GIN full-text index memories_content_fts_idx...');
    await sql`
      CREATE INDEX IF NOT EXISTS "memories_content_fts_idx" 
      ON "memories" 
      USING gin (to_tsvector('english', "content"));
    `;
    logger.info('✅ GIN full-text index created or verified.');

    // 6. Verify indexes in PostgreSQL pg_indexes
    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'memories';
    `;
    logger.info({ indexes }, '📊 All verified indexes on memories table');

    logger.info('🎉 Stage 3 migration completed successfully!');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, '❌ Failed to apply Stage 3 migration');
    process.exit(1);
  }
}

applyStage3Migration();
