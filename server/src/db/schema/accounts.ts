import { pgTable, uuid, text, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

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
  statusCheck: check('connected_accounts_status_valid', sql`${table.status} IN ('active', 'error', 'disconnected')`),
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
  statusCheck: check('sync_states_status_valid', sql`${table.status} IN ('idle', 'syncing', 'error')`),
  serviceCheck: check('sync_states_service_valid', sql`${table.service} IN ('gmail', 'calendar')`),
}));
