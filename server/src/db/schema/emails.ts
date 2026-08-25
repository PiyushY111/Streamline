import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/pg-core';
import { connectedAccounts } from './accounts.js';

// Email Threads
export const emailThreads = pgTable('email_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  externalThreadId: text('external_thread_id').notNull(),
  subject: text('subject'),
  snippet: text('snippet'),
  lastMessageAt: timestamp('last_message_at'),
  isStarred: boolean('is_starred').default(false).notNull(),
  isImportant: boolean('is_important').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accountThreadIdx: uniqueIndex('account_thread_idx').on(table.accountId, table.externalThreadId),
}));

// Emails
export const emails = pgTable('emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').references(() => emailThreads.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  externalMessageId: text('external_message_id').notNull(),
  sender: text('sender').notNull(),
  recipients: text('recipients').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  subject: text('subject'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  receivedAt: timestamp('received_at').notNull(),
  sentAt: timestamp('sent_at'),
  folder: text('folder').default('inbox').notNull(),
  category: text('category').default('primary').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  isStarred: boolean('is_starred').default(false).notNull(),
  isImportant: boolean('is_important').default(false).notNull(),
  attachments: jsonb('attachments').$type<Array<{ filename: string; mimeType: string; size: number; attachmentId?: string; content?: string }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accountReceivedIdx: index('emails_account_received_idx').on(table.accountId, table.receivedAt),
  accountReadIdx: index('emails_read_idx').on(table.accountId, table.isRead),
  accountMsgIdx: uniqueIndex('account_msg_idx').on(table.accountId, table.externalMessageId),
}));

// Labels
export const labels = pgTable('labels', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  externalLabelId: text('external_label_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // system | user
}, (table) => ({
  accountLabelIdx: uniqueIndex('account_label_idx').on(table.accountId, table.externalLabelId),
}));

// Email Labels Junction
export const emailLabels = pgTable('email_labels', {
  emailId: uuid('email_id').references(() => emails.id, { onDelete: 'cascade' }).notNull(),
  labelId: uuid('label_id').references(() => labels.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.emailId, table.labelId] }),
}));

// Attachments
export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').references(() => emails.id, { onDelete: 'cascade' }).notNull(),
  externalAttachmentId: text('external_attachment_id').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storageReference: text('storage_reference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
