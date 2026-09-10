import { neon } from '@neondatabase/serverless';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

async function cleanupSeeds() {
  logger.info('🧹 Cleaning up seeded development records...');
  const sql = neon(env.DATABASE_URL);

  try {
    await sql`DELETE FROM emails WHERE external_message_id LIKE 'seed_%'`;
    await sql`DELETE FROM events WHERE external_event_id LIKE 'seed_%'`;
    await sql`DELETE FROM tasks WHERE title IN (
      'Review Q3 Product Architecture & API Specs',
      'Prepare Presentation for Academic Advisory Meeting',
      'Follow up on Client Onboarding & Security Clearance',
      'Set up Automated CI/CD Build & Type-Check Pipeline',
      'Schedule 1:1 Mentorship Sessions for September'
    )`;
    logger.info('✅ Seed cleanup completed successfully.');
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to cleanup seed records');
    process.exit(1);
  }
}

cleanupSeeds().catch((err) => {
  logger.error({ err }, 'Fatal error during seed cleanup');
  process.exit(1);
});
