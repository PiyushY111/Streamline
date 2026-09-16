import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { connectedAccounts } from './accounts.js';
import { emails } from './emails.js';

// Calendars
export const calendars = pgTable(
  'calendars',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => connectedAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    externalCalendarId: text('external_calendar_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    timezone: text('timezone'),
    color: text('color'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
  },
  (table) => ({
    accountCalIdx: uniqueIndex('account_cal_idx').on(table.accountId, table.externalCalendarId),
  }),
);

// Calendar Events
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    calendarId: uuid('calendar_id')
      .references(() => calendars.id, { onDelete: 'cascade' })
      .notNull(),
    accountId: uuid('account_id')
      .references(() => connectedAccounts.id, { onDelete: 'cascade' })
      .notNull(),
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
  },
  (table) => ({
    accountTimeIdx: index('events_account_time_idx').on(table.accountId, table.startTime, table.endTime),
    accountEventIdx: uniqueIndex('account_event_idx').on(table.accountId, table.externalEventId),
  }),
);

// Event Attendees
export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  name: text('name'),
  responseStatus: text('response_status').default('needsAction').notNull(),
  organizer: boolean('organizer').default(false).notNull(),
});
