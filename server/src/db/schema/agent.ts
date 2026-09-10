import { pgTable, uuid, text, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// A conversation thread with the agent
export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title'), // optional, derived from first message
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userSessionIdx: index('agent_sessions_user_idx').on(table.userId, table.updatedAt),
  })
);

// Every turn in a session — user messages, model responses, and tool-call records
export const agentMessages = pgTable(
  'agent_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => agentSessions.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull(), // 'user' | 'model' | 'tool'
    content: text('content'), // natural-language content, nullable for pure tool-call turns
    toolCalls: jsonb('tool_calls').$type<
      Array<{ id?: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }>
    >(),
    toolName: text('tool_name'), // set on role='tool' result turns
    toolResult: jsonb('tool_result'),

    // Enterprise OpenTelemetry & Observability Extensions:
    spanId: text('span_id'),
    parentSpanId: text('parent_span_id'),
    latencyMs: integer('latency_ms'),
    retrievedMemoryIds: jsonb('retrieved_memory_ids').$type<string[]>().default([]),
    tokenPromptCount: integer('token_prompt_count').default(0),
    tokenCandidateCount: integer('token_candidate_count').default(0),
    costUsd: text('cost_usd').default('0.000000'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionMsgIdx: index('agent_messages_session_idx').on(table.sessionId, table.createdAt),
    spanIdx: index('agent_messages_span_idx').on(table.spanId),
    latencyIdx: index('agent_messages_latency_idx').on(table.latencyMs),
  })
);

// The permission boundary, made durable. Every write/send tool call lands here
// BEFORE execution — this table is the single choke point consequential actions pass through.
export const pendingActions = pgTable(
  'pending_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: uuid('session_id').references(() => agentSessions.id, { onDelete: 'set null' }),
    toolName: text('tool_name').notNull(),
    toolArgs: jsonb('tool_args').$type<Record<string, unknown>>().notNull(),
    status: text('status').default('pending').notNull(), // pending | approved | rejected | executed | failed | expired
    reasoning: text('reasoning'), // why the agent proposed this, for the user to review before approving
    impactPreview: jsonb('impact_preview').$type<Record<string, unknown>>(), // human-friendly diff of changes
    idempotencyKey: text('idempotency_key').unique(),
    expiresAt: timestamp('expires_at').notNull(),
    resultJson: jsonb('result_json'),
    errorJson: jsonb('error_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => ({
    userStatusIdx: index('pending_actions_user_status_idx').on(table.userId, table.status),
  })
);
