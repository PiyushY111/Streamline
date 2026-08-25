import { db } from '../src/db/index.js';
import { users } from '../src/db/schema/index.js';
import { logger } from '../src/utils/logger.js';

async function testConnection() {
  try {
    const result = await db.select().from(users).limit(1);
    logger.info({ count: result.length }, 'Successfully queried database');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Failed to query database');
    process.exit(1);
  }
}

testConnection();
