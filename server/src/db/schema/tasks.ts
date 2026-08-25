import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { emails } from './emails.js';
import { events } from './events.js';

// Tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('todo').notNull(), // todo | in_progress | completed
  priority: text('priority').default('medium').notNull(), // low | medium | high
  dueAt: timestamp('due_at'),
  completedAt: timestamp('completed_at'),
  sourceEmailId: uuid('source_email_id').references(() => emails.id, { onDelete: 'set null' }),
  sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userTaskIdx: index('tasks_user_status_due_idx').on(table.userId, table.status, table.dueAt),
}));
