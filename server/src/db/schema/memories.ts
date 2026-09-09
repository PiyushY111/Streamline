import { pgTable, uuid, text, timestamp, vector, index, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    type: text('type').notNull(), // 'preference' | 'decision' | 'project_fact'
    content: text('content').notNull(),
    sourceRef: text('source_ref'), // 'agent_session:<uuid>', 'pending_action:<uuid>', or 'explicit_user_request'
    embedding: vector('embedding', { dimensions: 768 }),
    status: text('status').default('active').notNull(), // 'active' | 'superseded' | 'archived'
    supersededBy: uuid('superseded_by'),
    accessCount: integer('access_count').default(0).notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusTypeIdx: index('memories_user_status_type_idx').on(table.userId, table.status, table.type),
  })
);
