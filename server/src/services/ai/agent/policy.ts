import { db } from '../../../db/index.js';
import { pendingActions } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { TOOL_REGISTRY } from './tools/index.js';
import { auditService } from '../../audit.service.js';
import { logger } from '../../../utils/logger.js';
import { extractMemoryFromInteraction } from '../memory/extraction.service.js';
import { toError } from '../../../utils/errors.js';

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
  call: ProposedToolCall,
): Promise<PolicyOutcome> {
  const tool = Object.prototype.hasOwnProperty.call(TOOL_REGISTRY, call.name) ? TOOL_REGISTRY[call.name] : undefined;

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

  const validatedArgs = parseResult.data as Record<string, unknown>;

  // 3. Read Tool — Safe to execute inline immediately
  if (tool.permissionClass === 'read') {
    try {
      const result = await tool.execute(userId, validatedArgs);
      await auditService.logAction(userId, `agent.tool.read.${call.name}`, { args: validatedArgs });
      return { kind: 'executed', result };
    } catch (rawErr: unknown) {
      const err = toError(rawErr);
      logger.error({ err: err.message, toolName: call.name }, 'Read tool execution error');
      return { kind: 'rejected', reason: `Tool execution failed: ${err.message}` };
    }
  }

  // 4. Idempotency check: if tool call has an idempotency key, check for duplicate submission
  const providedIdempotencyKey = (validatedArgs?.idempotencyKey as string | undefined) || null;
  if (providedIdempotencyKey) {
    try {
      const [existing] = await db
        .select()
        .from(pendingActions)
        .where(and(eq(pendingActions.idempotencyKey, providedIdempotencyKey), eq(pendingActions.userId, userId)))
        .limit(1);

      if (existing) {
        logger.info(
          { idempotencyKey: providedIdempotencyKey, pendingActionId: existing.id },
          'Deduplicated tool call via idempotency key',
        );
        return {
          kind: 'pending',
          pendingActionId: existing.id,
          impactPreview: (existing.impactPreview as Record<string, unknown>) || {},
        };
      }
    } catch (checkErr: unknown) {
      logger.debug({ err: toError(checkErr).message }, 'Non-fatal error checking idempotency key');
    }
  }

  // 5. Write or Send Tool — Consequential side effect. NEVER auto-execute.
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
      idempotencyKey: providedIdempotencyKey,
      expiresAt,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create pending action record');
  }

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
  options: { idempotencyKey?: string } = {},
) {
  // 1. Fetch action with ownership validation
  const [action] = await db
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)))
    .limit(1);

  if (!action) {
    throw new Error('Pending action not found or not owned by user');
  }

  // 2. Idempotent replay: if the action is already executed and the idempotencyKey matches, return cached result
  if (
    action.status === 'executed' &&
    options.idempotencyKey &&
    action.idempotencyKey &&
    action.idempotencyKey === options.idempotencyKey
  ) {
    logger.info(
      { pendingActionId, idempotencyKey: options.idempotencyKey },
      'Returning cached action result for idempotent replay',
    );
    return action.resultJson;
  }

  // 3. State verification
  if (action.status !== 'pending') {
    throw new Error(`Action already resolved with status: "${action.status}"`);
  }

  // 3. Expiration check (24-hour TTL)
  if (new Date(action.expiresAt) <= new Date()) {
    await db
      .update(pendingActions)
      .set({ status: 'expired', resolvedAt: new Date() })
      .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)));
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

  // 6. Atomic state claim to prevent double-execution race condition
  const effectiveIdempotencyKey = options.idempotencyKey || action.idempotencyKey || null;
  const updateClaimQuery = db
    .update(pendingActions)
    .set({
      status: 'executing',
      idempotencyKey: effectiveIdempotencyKey,
    })
    .where(
      and(
        eq(pendingActions.id, pendingActionId),
        eq(pendingActions.userId, userId),
        eq(pendingActions.status, 'pending'),
      ),
    );

  if (typeof (updateClaimQuery as any).returning === 'function') {
    const [claimed] = await (updateClaimQuery as any).returning();
    if (!claimed) {
      // Another concurrent worker claimed or resolved it
      const [current] = await db
        .select()
        .from(pendingActions)
        .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)))
        .limit(1);
      if (current?.status === 'executed') {
        return current.resultJson;
      }
      throw new Error(`Action already resolved with status: "${current?.status || 'executing'}"`);
    }
  } else {
    await updateClaimQuery;
  }

  try {
    // 7. Execute real service
    const result = await tool.execute(userId, action.toolArgs);

    // 8. Atomic state update
    await db
      .update(pendingActions)
      .set({
        status: 'executed',
        resultJson: result,
        idempotencyKey: effectiveIdempotencyKey,
        resolvedAt: new Date(),
      })
      .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)));

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
        `pending_action:${pendingActionId}`,
      ).catch((rawErr: unknown) =>
        logger.warn({ err: toError(rawErr).message }, 'Background memory extraction failed, non-fatal'),
      );
    });

    return result;
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    // 10. Error recording
    await db
      .update(pendingActions)
      .set({
        status: 'failed',
        errorJson: { message: err.message, stack: err.stack },
        resolvedAt: new Date(),
      })
      .where(and(eq(pendingActions.id, pendingActionId), eq(pendingActions.userId, userId)));

    await auditService.logAction(userId, `agent.tool.failed.${action.toolName}`, {
      pendingActionId,
      error: err.message,
    });

    throw err;
  }
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

export const rejectPendingAction = rejectAction;
