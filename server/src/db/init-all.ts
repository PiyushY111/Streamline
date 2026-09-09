import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function initDatabaseSchema() {
  logger.info('Initializing all tables and schemas on the new Neon database...');
  const sql = neon(env.DATABASE_URL);

  // 1. Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash VARCHAR(255),
      avatar TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`;

  // 2. Connected Accounts table
  await sql`
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT DEFAULT 'google' NOT NULL,
      provider_account_id TEXT NOT NULL,
      email TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      avatar TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expires_at TIMESTAMP NOT NULL,
      scopes TEXT NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_provider_account_idx ON connected_accounts (user_id, provider_account_id);`;

  // 3. Email Threads table
  await sql`
    CREATE TABLE IF NOT EXISTS email_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      external_thread_id TEXT NOT NULL,
      subject TEXT,
      snippet TEXT,
      last_message_at TIMESTAMP,
      is_starred BOOLEAN DEFAULT false NOT NULL,
      is_important BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_thread_idx ON email_threads (account_id, external_thread_id);`;

  // 4. Emails table
  await sql`
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      external_message_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      recipients TEXT NOT NULL,
      cc TEXT,
      bcc TEXT,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      received_at TIMESTAMP NOT NULL,
      sent_at TIMESTAMP,
      folder TEXT DEFAULT 'inbox' NOT NULL,
      category TEXT DEFAULT 'primary' NOT NULL,
      is_read BOOLEAN DEFAULT false NOT NULL,
      is_starred BOOLEAN DEFAULT false NOT NULL,
      is_important BOOLEAN DEFAULT false NOT NULL,
      attachments JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'inbox' NOT NULL;`;
  await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'primary' NOT NULL;`;
  await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachments JSONB;`;
  await sql`CREATE INDEX IF NOT EXISTS emails_account_received_idx ON emails (account_id, received_at);`;
  await sql`CREATE INDEX IF NOT EXISTS emails_read_idx ON emails (account_id, is_read);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_msg_idx ON emails (account_id, external_message_id);`;

  // 5. Labels & Email Labels table
  await sql`
    CREATE TABLE IF NOT EXISTS labels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      external_label_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_label_idx ON labels (account_id, external_label_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_labels (
      email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (email_id, label_id)
    );
  `;

  // 6. Attachments table
  await sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      external_attachment_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_reference TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  // 7. Calendars & Events table
  await sql`
    CREATE TABLE IF NOT EXISTS calendars (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      external_calendar_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      timezone TEXT,
      color TEXT,
      is_primary BOOLEAN DEFAULT false NOT NULL,
      is_visible BOOLEAN DEFAULT true NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_cal_idx ON calendars (account_id, external_calendar_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      external_event_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      timezone TEXT,
      status TEXT DEFAULT 'confirmed' NOT NULL,
      recurrence_rule TEXT,
      html_link TEXT,
      source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS events_account_time_idx ON events (account_id, start_time, end_time);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_event_idx ON events (account_id, external_event_id);`;

  // 8. Event Attendees table
  await sql`
    CREATE TABLE IF NOT EXISTS event_attendees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT,
      response_status TEXT DEFAULT 'needsAction' NOT NULL,
      organizer BOOLEAN DEFAULT false NOT NULL
    );
  `;

  // 9. Projects & Tasks tables (Stage 1)
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      color TEXT DEFAULT '#3b82f6' NOT NULL,
      stack TEXT,
      current_milestone TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS projects_user_idx ON projects (user_id, status);`;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo' NOT NULL,
      priority TEXT DEFAULT 'medium' NOT NULL,
      due_at TIMESTAMP,
      completed_at TIMESTAMP,
      source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
      source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      importance REAL DEFAULT 0.5 NOT NULL,
      estimated_minutes REAL,
      dependencies JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS tasks_user_status_due_idx ON tasks (user_id, status, due_at);`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS importance REAL DEFAULT 0.5 NOT NULL;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes REAL;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]'::jsonb NOT NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);`;

  // 10. Audit Logs & Notifications & Sync States
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB,
      is_read BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      sync_cursor TEXT,
      last_synced_at TIMESTAMP,
      last_error TEXT,
      status TEXT DEFAULT 'idle' NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_service_idx ON sync_states (account_id, service);`;

  // 11. User AI Preferences table
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

  // 12. Email AI Metadata table
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
  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_thread_idx ON email_ai_metadata (thread_id);`;
  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_priority_idx ON email_ai_metadata (priority);`;
  await sql`CREATE INDEX IF NOT EXISTS email_ai_metadata_category_idx ON email_ai_metadata (category);`;

  // 13. Daily Digests table
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
  await sql`CREATE INDEX IF NOT EXISTS daily_digests_user_idx ON daily_digests (user_id, digest_date);`;

  // 14. AI Token Usage table
  await sql`
    CREATE TABLE IF NOT EXISTS ai_token_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model VARCHAR(100) NOT NULL,
      operation VARCHAR(50) NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd VARCHAR(30) NOT NULL DEFAULT '0.000000',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS ai_token_usage_user_idx ON ai_token_usage (user_id, created_at);`;
  await sql`CREATE INDEX IF NOT EXISTS ai_token_usage_operation_idx ON ai_token_usage (operation);`;

  logger.info('🎉 All tables, foreign keys, and indexes initialized successfully on the new Neon database!');
}

if (process.argv[1]?.endsWith('init-all.ts') || process.argv[1]?.endsWith('init-all.js')) {
  initDatabaseSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Failed to initialize database schema');
      process.exit(1);
    });
}
