import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function runMigrations() {
  logger.info('Connecting to Neon PostgreSQL to execute migrations...');
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql);

  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  logger.info({ migrationsFolder }, 'Applying database migrations...');

  await migrate(db, { migrationsFolder });
  logger.info('Database migrations applied successfully!');
}

runMigrations().catch((err) => {
  logger.error({ err }, 'Failed to run database migrations');
  process.exit(1);
});
