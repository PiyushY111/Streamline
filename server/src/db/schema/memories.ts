import { pgTable, uuid, text, timestamp, vector, index, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const DEFAULT_EMBEDDING_MODEL_VERSION = 'text-embedding-004';

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // 'preference' | 'decision' | 'project_fact'
    content: text('content').notNull(),
    sourceRef: text('source_ref'), // 'agent_session:<uuid>', 'pending_action:<uuid>', or 'explicit_user_request'
    embedding: vector('embedding', { dimensions: 768 }),
    embeddingModelVersion: text('embedding_model_version').default('text-embedding-004').notNull(),
    status: text('status').default('active').notNull(), // 'active' | 'superseded' | 'archived'
    supersededBy: uuid('superseded_by'),
    accessCount: integer('access_count').default(0).notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusTypeIdx: index('memories_user_status_type_idx').on(table.userId, table.status, table.type),
    userModelVersionIdx: index('memories_user_model_version_idx').on(table.userId, table.embeddingModelVersion),
    typeCheck: check('memories_type_valid', sql`${table.type} IN ('preference', 'decision', 'project_fact')`),
    statusCheck: check('memories_status_valid', sql`${table.status} IN ('active', 'superseded', 'archived')`),
  }),
);
