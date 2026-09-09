import { db } from '../db/index.js';
import { pendingActions } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { TOOL_REGISTRY } from './tools/index.js';
import { auditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';
import { extractMemoryFromInteraction } from '../services/ai/memory-extraction.service.js';

export interface ProposedToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  reasoning?: string;
}

export type PolicyOutcome =
  | { kind: 'executed'; result: unknown }
  | { kind: 'pending'; pendingActionId: string; impactPreview: Record<string, unknown> }
  | { kind: 'rejected'; reason: string; validationErrors?: unknown };

/**
 * Stage 2 Policy Engine: Single choke point for all agent actions.
 * Read tools execute inline.
 * Write & Send tools strictly queue into pending_actions.
 * Unknown or malformed tools are rejected before execution.
 */
export async function enforcePolicy(
  userId: string,
  sessionId: string | null,
  call: ProposedToolCall
): Promise<PolicyOutcome> {
  const tool = TOOL_REGISTRY[call.name];

  // 1. Unknown tool name — LLM hallucinated an unregistered tool
  if (!tool) {
    logger.warn({ toolName: call.name, userId }, 'Policy rejected unknown tool');
    return { kind: 'rejected', reason: `Unknown tool: "${call.name}". Tool is not registered in system.` };
  }

  // 2. Pre-execution Zod Schema Validation
  const parseResult = tool.schema.safeParse(call.args);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    logger.warn({ toolName: call.name, errorMsg }, 'Policy rejected tool call with invalid arguments');
    return {
      kind: 'rejected',
      reason: `Invalid arguments for tool "${call.name}": ${errorMsg}`,
      validationErrors: parseResult.error.format(),
    };
  }

  const validatedArgs = parseResult.data;

  // 3. Read Tool — Safe to execute inline immediately
  if (tool.permissionClass === 'read') {
    try {
      const result = await tool.execute(userId, validatedArgs);
      await auditService.logAction(userId, `agent.tool.read.${call.name}`, { args: validatedArgs });
      return { kind: 'executed', result };
    } catch (err: any) {
      logger.error({ err: err.message, toolName: call.name }, 'Read tool execution error');
      return { kind: 'rejected', reason: `Tool execution failed: ${err.message}` };
    }
  }

  // 4. Write or Send Tool — Consequential side effect. NEVER auto-execute.
  // Generate structured impact preview for human review
  const impactPreview = tool.generateImpactPreview(validatedArgs);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour TTL

  const [row] = await db
    .insert(pendingActions)
    .values({
      userId,
      sessionId: sessionId || null,
      toolName: call.name,
      toolArgs: validatedArgs,
      status: 'pending',
      reasoning: call.reasoning || null,
      impactPreview,
      expiresAt,
    })
    .returning();

  await auditService.logAction(userId, `agent.tool.queued.${call.name}`, {
    pendingActionId: row.id,
    toolName: call.name,
    impactPreview,
  });

  return {
    kind: 'pending',
    pendingActionId: row.id,
    impactPreview,
  };
}

/**
 * Execute an approved action with atomic database row lock,
 * ownership verification, expiration check, and idempotency protection.
 */
export async function executeApprovedAction(
  userId: string,
  pendingActionId: string,
  options: { idempotencyKey?: string } = {}
) {
  return await db.transaction(async (tx) => {
    // 1. Fetch with row-level lock
    const [action] = await tx
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)))
      .for('update');

    if (!action) {
      throw new Error('Pending action not found or not owned by user');
    }

    // 2. State verification
    if (action.status !== 'pending') {
      throw new Error(`Action already resolved with status: "${action.status}"`);
    }

    // 3. Expiration check (24-hour TTL)
    if (new Date(action.expiresAt) <= new Date()) {
      await tx
        .update(pendingActions)
        .set({ status: 'expired', resolvedAt: new Date() })
        .where(eq(pendingActions.id, pendingActionId));
      throw new Error('This pending action has expired (24h time limit exceeded).');
    }

    // 4. Idempotency validation
    if (options.idempotencyKey && action.idempotencyKey && action.idempotencyKey !== options.idempotencyKey) {
      throw new Error('Idempotency key mismatch.');
    }

    // 5. Tool resolution
    const tool = TOOL_REGISTRY[action.toolName];
    if (!tool) {
      throw new Error(`Unknown tool: "${action.toolName}"`);
    }

    try {
      // 6. Execute real service
      const result = await tool.execute(userId, action.toolArgs);

      // 7. Atomic state update
      await tx
        .update(pendingActions)
        .set({
          status: 'executed',
          resultJson: result,
          idempotencyKey: options.idempotencyKey || action.idempotencyKey || null,
          resolvedAt: new Date(),
        })
        .where(eq(pendingActions.id, pendingActionId));

      await auditService.logAction(userId, `agent.tool.executed.${action.toolName}`, {
        pendingActionId,
        toolName: action.toolName,
      });

      // 9. Fire-and-forget background memory extraction (decoupled from response latency)
      setImmediate(() => {
        extractMemoryFromInteraction(
          userId,
          `Approved action: ${action.toolName} with arguments ${JSON.stringify(action.toolArgs)}`,
          JSON.stringify(result),
          `pending_action:${pendingActionId}`
        ).catch((err) => logger.warn({ err: err.message }, 'Background memory extraction failed, non-fatal'));
      });

      return result;
    } catch (err: any) {
      // 8. Error recording
      await tx
        .update(pendingActions)
        .set({
          status: 'failed',
          errorJson: { message: err.message, stack: err.stack },
          resolvedAt: new Date(),
        })
        .where(eq(pendingActions.id, pendingActionId));

      await auditService.logAction(userId, `agent.tool.failed.${action.toolName}`, {
        pendingActionId,
        error: err.message,
      });

      throw err;
    }
  });
}

/**
 * Reject a pending action
 */
export async function rejectAction(userId: string, pendingActionId: string) {
  const [action] = await db
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)))
    .limit(1);

  if (!action) {
    throw new Error('Pending action not found or not owned by user');
  }

  if (action.status !== 'pending') {
    throw new Error(`Action already resolved with status: "${action.status}"`);
  }

  const [updated] = await db
    .update(pendingActions)
    .set({
      status: 'rejected',
      resolvedAt: new Date(),
    })
    .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)))
    .returning();

  await auditService.logAction(userId, 'agent.tool.rejected', {
    pendingActionId,
    toolName: action.toolName,
  });

  return updated;
}
