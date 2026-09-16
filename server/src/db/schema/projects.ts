import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').default('active').notNull(), // active | paused | completed | archived
    color: text('color').default('#3b82f6').notNull(),
    stack: text('stack'), // e.g. "Next.js + Drizzle"
    currentMilestone: text('current_milestone'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userProjectIdx: index('projects_user_idx').on(table.userId, table.status),
  }),
);
