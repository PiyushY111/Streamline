import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userStyleProfiles = pgTable(
  'user_style_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    formality: text('formality').default('balanced').notNull(), // 'casual' | 'balanced' | 'formal'
    brevity: text('brevity').default('concise').notNull(), // 'concise' | 'balanced' | 'detailed'
    avgSentenceLength: integer('avg_sentence_length').default(14).notNull(),
    preferredGreeting: text('preferred_greeting').default('Hi').notNull(),
    preferredSignoff: text('preferred_signoff').default('Best').notNull(),
    useBulletPoints: boolean('use_bullet_points').default(false).notNull(),
    sampleSentSnippets: jsonb('sample_sent_snippets').$type<string[]>().default([]).notNull(),
    traitsDescription: text('traits_description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('user_style_profiles_user_idx').on(table.userId),
  }),
);
