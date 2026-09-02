import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function migrateAiTables() {
  logger.info('Running AI tables migration...');
  const sql = neon(env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS user_ai_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      digest_time TIME NOT NULL DEFAULT '08:00:00',
      digest_timezone TEXT NOT NULL DEFAULT 'UTC',
      digest_delivery_mode TEXT NOT NULL DEFAULT 'in_app',
      is_auto_triage_enabled BOOLEAN NOT NULL DEFAULT true,
      vip_senders JSONB NOT NULL DEFAULT '[]'::jsonb,
      custom_instructions TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS email_ai_metadata (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email_id UUID NOT NULL UNIQUE REFERENCES emails(id) ON DELETE CASCADE,
      thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
      priority TEXT NOT NULL,
      urgency_score INTEGER NOT NULL DEFAULT 50,
      category TEXT NOT NULL,
      one_sentence_summary TEXT,
      newsletter_topic TEXT,
      extracted_tasks JSONB,
      sentiment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_digests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      digest_date TIMESTAMP NOT NULL DEFAULT NOW(),
      executive_greeting TEXT NOT NULL,
      schedule_summary TEXT,
      newsletter_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
      action_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_thread_idx ON email_ai_metadata (thread_id);`;
  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_priority_idx ON email_ai_metadata (priority);`;
  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_category_idx ON email_ai_metadata (category);`;
  await sql`CREATE INDEX IF NOT EXISTS daily_digests_user_idx ON daily_digests (user_id, digest_date);`;

  logger.info('✅ AI tables and indexes created successfully!');
}

migrateAiTables().catch((err) => {
  logger.error({ err }, '❌ AI tables migration failed');
  process.exit(1);
});
