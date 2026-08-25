import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';

async function migrate() {
  console.log('Migrating database schema for password auth...');
  const sql = neon(env.DATABASE_URL);
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`;
  console.log('✅ Column password_hash added to users table successfully!');
}

migrate().catch(console.error);
