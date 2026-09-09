import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function testPgVector() {
  logger.info('🔌 Connecting to Neon PostgreSQL to verify pgvector extension...');
  const sql = neon(env.DATABASE_URL);

  try {
    // 1. Enable pgvector extension
    logger.info('⚙️ Executing: CREATE EXTENSION IF NOT EXISTS vector;');
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

    // 2. Verify extension status and version
    const extResult = await sql`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector';
    `;
    logger.info({ extension: extResult }, '✅ pgvector extension is active in Neon PostgreSQL!');

    // 3. Create throwaway smoke test table
    logger.info('🧪 Creating throwaway test table with 3-dimensional vector column...');
    await sql`
      CREATE TABLE IF NOT EXISTS _pgvector_smoke_test (
        id serial PRIMARY KEY,
        name text NOT NULL,
        embedding vector(3)
      );
    `;

    // Clear any previous smoke test rows
    await sql`TRUNCATE TABLE _pgvector_smoke_test;`;

    // 4. Insert sample embeddings
    logger.info('📥 Inserting sample vectors...');
    await sql`
      INSERT INTO _pgvector_smoke_test (name, embedding) VALUES 
      ('target', '[1, 2, 3]'),
      ('close', '[1, 2, 4]'),
      ('far', '[10, 20, 30]');
    `;

    // 5. Query similarity distance using L2 distance (<->)
    logger.info('🔍 Executing vector similarity search (L2 distance <->)...');
    const results = await sql`
      SELECT id, name, embedding <-> '[1, 2, 3]' AS distance
      FROM _pgvector_smoke_test
      ORDER BY distance ASC
      LIMIT 3;
    `;

    logger.info({ results }, '📊 Vector query results returned successfully');

    // 6. Assert result order (target distance = 0, close distance = ~1, far distance = large)
    if (
      results.length === 3 &&
      results[0].name === 'target' &&
      Math.abs(Number(results[0].distance) - 0) < 0.001 &&
      results[1].name === 'close'
    ) {
      logger.info('🎉 pgvector smoke test PASSED with 100% accuracy!');
    } else {
      throw new Error(`Unexpected query ordering: ${JSON.stringify(results)}`);
    }

    // 7. Cleanup throwaway table
    await sql`DROP TABLE IF EXISTS _pgvector_smoke_test;`;
    logger.info('🧹 Cleaned up temporary test table');
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, '❌ Failed to verify pgvector on Neon');
    process.exit(1);
  }
}

testPgVector()
  .then(() => {
    logger.info('🚀 pgvector verification completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, 'Fatal error during pgvector test');
    process.exit(1);
  });
