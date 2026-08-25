import { db } from './client.js';
import { sql } from 'drizzle-orm';

async function migrateFolder() {
  console.log('Migrating emails table to include folder column...');
  await db.execute(sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS folder text DEFAULT 'inbox' NOT NULL;`);
  console.log('✅ Migration complete: folder column added to emails table');
}

migrateFolder().catch(console.error);
