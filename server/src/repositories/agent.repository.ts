import { db } from '../db/index.js';
import { agentSessions, agentMessages, pendingActions } from '../db/schema/index.js';
import { eq, and, asc, desc, gt } from 'drizzle-orm';

export interface CreateAgentMessageInput {
  sessionId: string;
  role: string;
  content?: string | null;
  toolCalls?: Array<{ id?: string; name: string; args: Record<string, unknown> }>;
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
    const [newSession] = await db
      .insert(agentSessions)
      .values({ userId, title })
      .returning();
    return newSession;
  }

  async updateSessionTitle(sessionId: string, title: string) {
    return db
      .update(agentSessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionId));
  }

  async touchSession(sessionId: string) {
    return db
      .update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionId));
  }

  // Message Methods
  async listSessionMessages(sessionId: string) {
    return db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(asc(agentMessages.createdAt));
  }

  async createMessage(values: CreateAgentMessageInput) {
    return db
      .insert(agentMessages)
      .values({
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
          gt(pendingActions.expiresAt, new Date())
        )
      )
      .orderBy(desc(pendingActions.createdAt));
  }

  async listSessionPendingActions(sessionId: string) {
    return db
      .select()
      .from(pendingActions)
      .where(eq(pendingActions.sessionId, sessionId));
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
    updates: {
      status?: string;
      resultJson?: unknown;
      errorJson?: unknown;
      resolvedAt?: Date;
      impactPreview?: Record<string, unknown>;
    }
  ) {
    return db
      .update(pendingActions)
      .set(updates as any)
      .where(eq(pendingActions.id, id));
  }
}

export const agentRepository = new AgentRepository();
