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

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Connected Google Accounts
export const connectedAccounts = pgTable('connected_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').default('google').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  email: text('email').notNull(),
  label: text('label').notNull(), // e.g. "Personal", "Agency"
  color: text('color').notNull(), // Hex color code
  avatar: text('avatar'),
  accessToken: text('access_token').notNull(), // Encrypted at rest
  refreshToken: text('refresh_token').notNull(), // Encrypted at rest
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  scopes: text('scopes').notNull(),
  status: text('status').default('active').notNull(), // active | error | disconnected
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userProviderIdx: uniqueIndex('user_provider_account_idx').on(table.userId, table.providerAccountId),
}));

// Sync States (Per account per service)
export const syncStates = pgTable('sync_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  service: text('service').notNull(), // 'gmail' | 'calendar'
  syncCursor: text('sync_cursor'), // Gmail historyId or Calendar syncToken
  lastSyncedAt: timestamp('last_synced_at'),
  lastError: text('last_error'),
  status: text('status').default('idle').notNull(), // idle | syncing | error
}, (table) => ({
  accountServiceIdx: uniqueIndex('account_service_idx').on(table.accountId, table.service),
}));

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

// Calendars
export const calendars = pgTable('calendars', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  externalCalendarId: text('external_calendar_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  timezone: text('timezone'),
  color: text('color'),
  isPrimary: boolean('is_primary').default(false).notNull(),
  isVisible: boolean('is_visible').default(true).notNull(),
}, (table) => ({
  accountCalIdx: uniqueIndex('account_cal_idx').on(table.accountId, table.externalCalendarId),
}));

// Calendar Events
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  calendarId: uuid('calendar_id').references(() => calendars.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => connectedAccounts.id, { onDelete: 'cascade' }).notNull(),
  externalEventId: text('external_event_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  timezone: text('timezone'),
  status: text('status').default('confirmed').notNull(),
  recurrenceRule: text('recurrence_rule'),
  htmlLink: text('html_link'),
  sourceEmailId: uuid('source_email_id').references(() => emails.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accountTimeIdx: index('events_account_time_idx').on(table.accountId, table.startTime, table.endTime),
  accountEventIdx: uniqueIndex('account_event_idx').on(table.accountId, table.externalEventId),
}));

// Event Attendees
export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  name: text('name'),
  responseStatus: text('response_status').default('needsAction').notNull(),
  organizer: boolean('organizer').default(false).notNull(),
});

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

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // digest | sync_error | reminder
  payload: jsonb('payload'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: text('action').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
