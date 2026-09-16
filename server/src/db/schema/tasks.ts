import { pgTable, uuid, text, timestamp, index, real, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { emails } from './emails.js';
import { events } from './events.js';
import { projects } from './projects.js';

// Tasks
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('todo').notNull(), // todo | in_progress | completed | cancelled
    priority: text('priority').default('medium').notNull(), // low | medium | high | urgent
    dueAt: timestamp('due_at'),
    completedAt: timestamp('completed_at'),
    sourceEmailId: uuid('source_email_id').references(() => emails.id, { onDelete: 'set null' }),
    sourceEventId: uuid('source_event_id').references(() => events.id, { onDelete: 'set null' }),

    // Stage 1 fields
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    importance: real('importance').default(0.5).notNull(), // 0.0 to 1.0
    estimatedMinutes: real('estimated_minutes'), // nullable for unestimated tasks
    dependencies: jsonb('dependencies').$type<string[]>().default([]).notNull(), // list of blocking task UUIDs

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userTaskIdx: index('tasks_user_status_due_idx').on(table.userId, table.status, table.dueAt),
    projectIdx: index('tasks_project_idx').on(table.projectId),
    importanceCheck: check('tasks_importance_range', sql`${table.importance} >= 0.0 AND ${table.importance} <= 1.0`),
    priorityCheck: check('tasks_priority_valid', sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`),
    statusCheck: check('tasks_status_valid', sql`${table.status} IN ('todo', 'in_progress', 'completed', 'cancelled')`),
  }),
);
