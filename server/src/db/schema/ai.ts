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
} from 'drizzle-orm/pg-core';
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
});

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
