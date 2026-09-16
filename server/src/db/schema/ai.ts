import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  time,
  jsonb,
  index,
  uniqueIndex,
  varchar,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { emails, emailThreads } from './emails.js';

export interface ExtractedTaskItem {
  id: string; // generated client/server UUID for identification
  title: string;
  type: 'assigned_to_me' | 'commitment_i_made' | 'followup_waiting_on';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  assignorOrAssignee?: string;
  confidence: number;
  isConverted?: boolean;
  isDismissed?: boolean;
}

export interface NewsletterTopicSummary {
  topic: string;
  headline: string;
  bulletPoints: string[];
  sourceEmailIds: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface DigestActionSummary {
  task: string;
  from: string;
  emailId: string;
  urgency: string;
  dueDate?: string;
}

// 1. User AI Configuration & Scheduled Digest Preferences
export const userAiPreferences = pgTable('user_ai_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  digestTime: time('digest_time').default('08:00:00').notNull(), // User's preferred digest hour (HH:MM:SS)
  digestTimezone: text('digest_timezone').default('UTC').notNull(),
  digestDeliveryMode: text('digest_delivery_mode').default('in_app').notNull(), // 'in_app' | 'email' | 'both'
  isAutoTriageEnabled: boolean('is_auto_triage_enabled').default(true).notNull(),
  vipSenders: jsonb('vip_senders').$type<string[]>().default([]).notNull(), // Senders automatically prioritized as P1
  customInstructions: text('custom_instructions'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  deliveryModeCheck: check('user_ai_preferences_delivery_mode_valid', sql`${table.digestDeliveryMode} IN ('in_app', 'email', 'both')`),
}));

// 2. Email AI Metadata (Triage, Priority & Extracted Intelligence)
export const emailAiMetadata = pgTable(
  'email_ai_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    emailId: uuid('email_id')
      .references(() => emails.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    threadId: uuid('thread_id')
      .references(() => emailThreads.id, { onDelete: 'cascade' })
      .notNull(),
    priority: text('priority').notNull(), // 'p1_urgent' | 'p2_important' | 'p3_updates' | 'p4_newsletter' | 'p5_low'
    urgencyScore: integer('urgency_score').default(50).notNull(), // 1 to 100
    category: text('category').notNull(), // 'action_required' | 'direct' | 'notification' | 'newsletter' | 'promotional'
    oneSentenceSummary: text('one_sentence_summary'),
    newsletterTopic: text('newsletter_topic'), // e.g. 'Technology', 'Economics', 'Design'
    extractedTasks: jsonb('extracted_tasks').$type<ExtractedTaskItem[]>(),
    sentiment: text('sentiment'), // 'urgent' | 'positive' | 'neutral' | 'tense'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('email_ai_metadata_email_idx').on(table.emailId),
    threadIdx: index('email_ai_metadata_thread_idx').on(table.threadId),
    priorityIdx: index('email_ai_metadata_priority_idx').on(table.priority),
    categoryIdx: index('email_ai_metadata_category_idx').on(table.category),
    priorityCheck: check('email_ai_metadata_priority_valid', sql`${table.priority} IN ('p1_urgent', 'p2_important', 'p3_updates', 'p4_newsletter', 'p5_low')`),
    urgencyCheck: check('email_ai_metadata_urgency_range', sql`${table.urgencyScore} >= 1 AND ${table.urgencyScore} <= 100`),
    categoryCheck: check('email_ai_metadata_category_valid', sql`${table.category} IN ('action_required', 'direct', 'notification', 'newsletter', 'promotional')`),
  })
);

// 3. Generated Daily Digests
export const dailyDigests = pgTable(
  'daily_digests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    digestDate: timestamp('digest_date').defaultNow().notNull(),
    executiveGreeting: text('executive_greeting').notNull(),
    scheduleSummary: text('schedule_summary'),
    newsletterTopics: jsonb('newsletter_topics').$type<NewsletterTopicSummary[]>().default([]).notNull(),
    actionSummary: jsonb('action_summary').$type<DigestActionSummary[]>().default([]).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userDigestIdx: index('daily_digests_user_idx').on(table.userId, table.digestDate),
  })
);

// 4. AI Token Usage, Cost Tracking & Circuit Breaker Records
export const aiTokenUsage = pgTable(
  'ai_token_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    operation: varchar('operation', { length: 50 }).notNull(), // 'triage' | 'reply_draft' | 'digest' | 'summary'
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    estimatedCostUsd: varchar('estimated_cost_usd', { length: 30 }).default('0.000000').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userTokenIdx: index('ai_token_usage_user_idx').on(table.userId, table.createdAt),
    operationIdx: index('ai_token_usage_operation_idx').on(table.operation),
  })
);
