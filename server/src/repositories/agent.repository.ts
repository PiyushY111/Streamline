import { db } from '../db/index.js';
import { agentSessions, agentMessages, pendingActions } from '../db/schema/index.js';
import { eq, and, asc, desc, gt } from 'drizzle-orm';

export interface CreateAgentMessageInput {
  sessionId: string;
  role: string;
  content?: string | null;
  toolCalls?: Array<{ id?: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }>;
  toolName?: string;
  toolResult?: unknown;
  spanId?: string;
  parentSpanId?: string;
  latencyMs?: number;
  retrievedMemoryIds?: string[];
  tokenPromptCount?: number;
  tokenCandidateCount?: number;
  costUsd?: string;
}

export class AgentRepository {
  // Session Methods
  async findSessionById(sessionId: string, userId: string) {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
      .limit(1);
    return session || null;
  }

  async listSessionsByUser(userId: string) {
    return db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.updatedAt));
  }

  async createSession(userId: string, title?: string) {
    const [newSession] = await db.insert(agentSessions).values({ userId, title }).returning();
    return newSession;
  }

  async updateSessionTitle(sessionId: string, userId: string, title: string) {
    const [updated] = await db
      .update(agentSessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
      .returning();
    return updated || null;
  }

  async touchSession(sessionId: string, userId?: string) {
    const conditions = [eq(agentSessions.id, sessionId)];
    if (userId) conditions.push(eq(agentSessions.userId, userId));
    return db
      .update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(and(...conditions));
  }

  // Message Methods
  async listSessionMessages(sessionId: string, userId?: string) {
    if (userId) {
      const [session] = await db
        .select({ id: agentSessions.id })
        .from(agentSessions)
        .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
        .limit(1);
      if (!session) return [];
    }

    return db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(asc(agentMessages.createdAt));
  }

  async createMessage(values: CreateAgentMessageInput) {
    return db.insert(agentMessages).values({
      sessionId: values.sessionId,
      role: values.role,
      content: values.content,
      toolCalls: values.toolCalls as any,
      toolName: values.toolName,
      toolResult: values.toolResult as any,
      spanId: values.spanId,
      parentSpanId: values.parentSpanId,
      latencyMs: values.latencyMs,
      retrievedMemoryIds: values.retrievedMemoryIds,
      tokenPromptCount: values.tokenPromptCount,
      tokenCandidateCount: values.tokenCandidateCount,
      costUsd: values.costUsd,
    });
  }

  // Pending Action Methods
  async listPendingActionsByUser(userId: string) {
    return db
      .select()
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.userId, userId),
          eq(pendingActions.status, 'pending'),
          gt(pendingActions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(pendingActions.createdAt));
  }

  async listSessionPendingActions(sessionId: string, userId?: string) {
    const conditions = [eq(pendingActions.sessionId, sessionId)];
    if (userId) conditions.push(eq(pendingActions.userId, userId));
    return db
      .select()
      .from(pendingActions)
      .where(and(...conditions));
  }

  async findPendingActionById(id: string, userId: string) {
    const [action] = await db
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
      .limit(1);
    return action || null;
  }

  async updatePendingAction(
    id: string,
    userId: string,
    updates: {
      status?: string;
      resultJson?: unknown;
      errorJson?: unknown;
      resolvedAt?: Date;
      impactPreview?: Record<string, unknown>;
    },
  ) {
    const [updated] = await db
      .update(pendingActions)
      .set(updates as any)
      .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
      .returning();
    return updated || null;
  }
}

export const agentRepository = new AgentRepository();
