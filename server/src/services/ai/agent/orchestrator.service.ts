import { getAiProvider } from '../core/factory.js';
import { getAiToolDeclarations } from './tools/index.js';
import { enforcePolicy } from './policy.js';
import { aiCostGuardService } from '../core/cost-guard.service.js';
import { db } from '../../../db/index.js';
import { agentSessions, agentMessages, pendingActions } from '../../../db/schema/index.js';
import { eq, and, desc, asc, gt } from 'drizzle-orm';
import { logger } from '../../../utils/logger.js';
import { redactSecrets } from '../../../utils/redactor.js';
import { toError, AllModelsExhaustedError } from '../../../utils/errors.js';
import {
  agentTraceEmitter,
  AgentLoopDetectedError,
  computeToolFingerprint,
  generateSpanId,
  type AgentTurnResult,
  type AgentStreamEvent,
  type AgentTurnOptions,
} from './orchestrator-stream.js';
import { AGENT_SYSTEM_INSTRUCTION, assembleTurnContext, loadSessionHistory } from './orchestrator-context.js';

export const MAX_TOOL_TURNS = 5;

// Re-export streaming types and utilities for seamless backward compatibility
export {
  agentTraceEmitter,
  AgentLoopDetectedError,
  computeToolFingerprint,
  generateSpanId,
  AGENT_SYSTEM_INSTRUCTION,
  type AgentTurnResult,
  type AgentStreamEvent,
  type AgentTurnOptions,
};

export class AgentOrchestratorService {
  /**
   * Orchestrates a single interactive agent turn within a multi-turn ReAct reasoning loop.
   */
  async runAgentTurn(
    userId: string,
    sessionId: string,
    userMessage: string,
    options: AgentTurnOptions = {},
  ): Promise<AgentTurnResult> {
    const overallTurnStart = Date.now();
    const rootSpanId = generateSpanId();

    // 1. Enforce AI circuit breaker & cost guard
    const circuit = await aiCostGuardService.checkCircuitBreaker(userId);
    if (circuit.isTripped) {
      const refusal = `⚠️ AI budget limit reached for today: ${circuit.reason}`;
      logger.warn(
        {
          userId,
          sessionId,
          reason: 'cost_guard_daily_limit',
          tokensToday: circuit.tokensToday,
          costTodayUsd: circuit.costTodayUsd,
        },
        'Agent turn short-circuited: cost guard daily limit tripped',
      );
      // Persisted so this shows up in trace.service.ts spans instead of leaving no trace at all.
      await db.insert(agentMessages).values({
        sessionId,
        role: 'model',
        content: refusal,
        spanId: rootSpanId,
        degradedReason: 'cost_guard_daily_limit',
      });
      options.onStreamEvent?.({ type: 'text_chunk', chunk: refusal });
      return { text: refusal, pendingActions: [], sessionId, spanId: rootSpanId };
    }

    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      const unavailable = 'AI provider is currently not available. Please check API configuration.';
      return { text: unavailable, pendingActions: [], sessionId, spanId: rootSpanId };
    }

    // 2. Assemble turn context, memory recall, and user message provenance
    const { relevantMemories, turnInstruction } = await assembleTurnContext(
      userId,
      sessionId,
      userMessage,
      rootSpanId,
      options,
    );

    const pendingActionsThisTurn: string[] = [];
    let finalText = '';
    let untrustedContentContext: { source: string; sender?: string } | null = null;
    const seenFingerprints = new Map<string, number>();
    let loopDetected = false;
    const tools = getAiToolDeclarations();

    // 3. Multi-turn execution loop (bounded by MAX_TOOL_TURNS)
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      if (options.abortSignal?.aborted) {
        logger.info({ userId, sessionId }, 'Agent turn aborted by client disconnect');
        break;
      }
      const modelSpanId = generateSpanId();
      options.onStreamEvent?.({ type: 'turn_start', turn, spanId: modelSpanId });

      // Reconstruct conversation history
      const chatMessages = await loadSessionHistory(sessionId);

      // Query active AI provider
      const modelStart = Date.now();
      let response;
      try {
        response = await provider.chatWithTools({
          messages: chatMessages,
          systemInstruction: turnInstruction,
          tools,
          models: options.models,
        });
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        const reason = err instanceof AllModelsExhaustedError ? err.lastReason : 'unknown';
        const attemptedModels = err instanceof AllModelsExhaustedError ? err.attemptedModels : undefined;
        logger.error(
          { userId, sessionId, reason, attemptedModels, err: err.message },
          `Agent turn model call failed (${reason}) — degrading gracefully instead of crashing the turn`,
        );
        finalText = `⚠️ AI service is temporarily degraded (${reason}). Please try again shortly.`;
        await db.insert(agentMessages).values({
          sessionId,
          role: 'model',
          content: finalText,
          spanId: modelSpanId,
          parentSpanId: rootSpanId,
          latencyMs: Date.now() - modelStart,
          degradedReason: reason,
        });
        options.onStreamEvent?.({ type: 'text_chunk', chunk: finalText });
        break;
      }
      const modelLatencyMs = Date.now() - modelStart;

      // Token attribution & Cost Guard recording
      const promptTokens =
        response.usage?.promptTokens ??
        aiCostGuardService.estimateTokens(turnInstruction + JSON.stringify(chatMessages));
      const completionTokens =
        response.usage?.completionTokens ??
        aiCostGuardService.estimateTokens(response.text || JSON.stringify(response.toolCalls || ''));

      const costResult = await aiCostGuardService.recordUsage({
        userId,
        model: response.model || 'gemini-3.5-flash-lite',
        operation: 'agent_turn',
        promptTokens,
        completionTokens,
      });

      // Check single-turn token circuit breaker limit
      const singleTurnGuard = aiCostGuardService.checkSingleTurnLimit(promptTokens + completionTokens);
      if (singleTurnGuard.isExceeded) {
        logger.warn(
          { userId, sessionId, reason: 'cost_guard_single_turn_limit', tokens: promptTokens + completionTokens },
          'Single-turn token limit exceeded',
        );
        finalText = `⚠️ Single-turn AI token limit exceeded (${singleTurnGuard.tokensInTurn} tokens). Execution stopped.`;
        await db.insert(agentMessages).values({
          sessionId,
          role: 'model',
          content: finalText,
          spanId: modelSpanId,
          parentSpanId: rootSpanId,
          latencyMs: modelLatencyMs,
          tokenPromptCount: promptTokens,
          tokenCandidateCount: completionTokens,
          costUsd: costResult.formattedCost,
          degradedReason: 'cost_guard_single_turn_limit',
        });
        options.onStreamEvent?.({ type: 'text_chunk', chunk: finalText });
        break;
      }

      // Case A: Model responded with final natural language text (no tool calls)
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalText = response.text || 'I have completed your request.';
        await db.insert(agentMessages).values({
          sessionId,
          role: 'model',
          content: redactSecrets(finalText),
          spanId: modelSpanId,
          parentSpanId: rootSpanId,
          latencyMs: modelLatencyMs,
          tokenPromptCount: promptTokens,
          tokenCandidateCount: completionTokens,
          costUsd: costResult.formattedCost,
        });

        options.onStreamEvent?.({ type: 'text_chunk', chunk: finalText });
        agentTraceEmitter.emit('trace_event', {
          sessionId,
          type: 'model_response',
          spanId: modelSpanId,
          parentSpanId: rootSpanId,
          latencyMs: modelLatencyMs,
          tokens: promptTokens + completionTokens,
        });
        break;
      }

      // Case B: Model proposed one or more tool calls
      await db.insert(agentMessages).values({
        sessionId,
        role: 'model',
        content: null,
        toolCalls: redactSecrets(response.toolCalls) as any,
        spanId: modelSpanId,
        parentSpanId: rootSpanId,
        latencyMs: modelLatencyMs,
        tokenPromptCount: promptTokens,
        tokenCandidateCount: completionTokens,
        costUsd: costResult.formattedCost,
      });

      agentTraceEmitter.emit('trace_event', {
        sessionId,
        type: 'tool_proposing',
        spanId: modelSpanId,
        parentSpanId: rootSpanId,
        toolCount: response.toolCalls.length,
      });

      for (const tc of response.toolCalls) {
        if (options.abortSignal?.aborted) {
          logger.info({ userId, sessionId }, 'Agent tool processing aborted by client disconnect');
          break;
        }

        const toolSpanId = generateSpanId();
        const fingerprint = computeToolFingerprint(tc.name, tc.args);
        const prevCount = seenFingerprints.get(fingerprint) || 0;
        const newCount = prevCount + 1;
        seenFingerprints.set(fingerprint, newCount);

        if (newCount >= 2) {
          logger.warn(
            { userId, sessionId, toolName: tc.name, fingerprint, count: newCount },
            'Agent tool loop detected',
          );
          options.onStreamEvent?.({
            type: 'tool_rejected',
            toolName: tc.name,
            reason: `Loop detected: tool '${tc.name}' called repeatedly with identical parameters (${fingerprint})`,
            spanId: toolSpanId,
          });

          await db.insert(agentMessages).values({
            sessionId,
            role: 'tool',
            toolName: tc.name,
            toolResult: {
              status: 'rejected_loop_detected',
              error: 'Loop detected: identical tool call repeated. Stopping execution.',
              fingerprint,
            },
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            latencyMs: 0,
          });

          finalText = `I detected a repetitive action loop for tool '${tc.name}' with identical arguments and stopped execution to prevent unbounded resource consumption.`;
          loopDetected = true;
          break;
        }

        options.onStreamEvent?.({
          type: 'tool_proposing',
          toolName: tc.name,
          args: tc.args,
          spanId: toolSpanId,
        });

        const toolStart = Date.now();
        const outcome = await enforcePolicy(userId, sessionId, {
          id: tc.id,
          name: tc.name,
          args: tc.args,
        });
        const toolLatencyMs = Date.now() - toolStart;

        if (outcome.kind === 'executed') {
          if (tc.name === 'get_email' && outcome.result) {
            const emailData = outcome.result as any;
            untrustedContentContext = {
              source: 'email',
              sender: emailData.sender || 'Unknown Sender',
            };
          }

          options.onStreamEvent?.({
            type: 'tool_executed',
            toolName: tc.name,
            result: outcome.result,
            spanId: toolSpanId,
            latencyMs: toolLatencyMs,
          });

          await db.insert(agentMessages).values({
            sessionId,
            role: 'tool',
            toolName: tc.name,
            toolResult: redactSecrets(outcome.result) as any,
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            latencyMs: toolLatencyMs,
          });

          agentTraceEmitter.emit('trace_event', {
            sessionId,
            type: 'tool_executed',
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            toolName: tc.name,
            latencyMs: toolLatencyMs,
          });
        } else if (outcome.kind === 'pending') {
          pendingActionsThisTurn.push(outcome.pendingActionId);

          let impactPreview = outcome.impactPreview;
          if (untrustedContentContext) {
            impactPreview = {
              ...outcome.impactPreview,
              _securityNotice: {
                untrustedContentTriggered: true,
                source: untrustedContentContext.source,
                sourceSender: untrustedContentContext.sender || 'External Sender',
                threatWarning:
                  'This action proposal was prompted after reading untrusted external email content. Review carefully before approving.',
              },
            };

            await db
              .update(pendingActions)
              .set({ impactPreview: redactSecrets(impactPreview) as any })
              .where(eq(pendingActions.id, outcome.pendingActionId));
          }

          options.onStreamEvent?.({
            type: 'action_queued',
            toolName: tc.name,
            pendingActionId: outcome.pendingActionId,
            impactPreview,
            spanId: toolSpanId,
          });

          await db.insert(agentMessages).values({
            sessionId,
            role: 'tool',
            toolName: tc.name,
            toolResult: {
              status: 'queued_for_human_approval',
              pendingActionId: outcome.pendingActionId,
              impactPreview: redactSecrets(impactPreview),
              message: 'Action queued for human approval. Inform the user and await their confirmation.',
            },
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            latencyMs: toolLatencyMs,
          });

          agentTraceEmitter.emit('trace_event', {
            sessionId,
            type: 'action_queued',
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            toolName: tc.name,
            pendingActionId: outcome.pendingActionId,
          });
        } else if (outcome.kind === 'rejected') {
          options.onStreamEvent?.({
            type: 'tool_rejected',
            toolName: tc.name,
            reason: outcome.reason,
            spanId: toolSpanId,
          });

          await db.insert(agentMessages).values({
            sessionId,
            role: 'tool',
            toolName: tc.name,
            toolResult: {
              status: 'rejected_by_policy',
              reason: outcome.reason,
              message: outcome.reason,
            },
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            latencyMs: toolLatencyMs,
          });

          agentTraceEmitter.emit('trace_event', {
            sessionId,
            type: 'tool_rejected',
            spanId: toolSpanId,
            parentSpanId: modelSpanId,
            toolName: tc.name,
            reason: outcome.reason,
          });
        }
      }

      if (loopDetected) {
        break;
      }
    }

    if (!finalText) {
      finalText = 'I reached the maximum allowed tool iterations for this turn. Here is the progress so far.';
      await db.insert(agentMessages).values({
        sessionId,
        role: 'model',
        content: finalText,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        latencyMs: 0,
      });
      options.onStreamEvent?.({ type: 'text_chunk', chunk: finalText });
    }

    const totalTurnDurationMs = Date.now() - overallTurnStart;

    const finalResult: AgentTurnResult = {
      text: finalText,
      pendingActions: pendingActionsThisTurn,
      sessionId,
      recalledMemories: relevantMemories.map((m) => ({ id: m.id, type: m.type, content: m.content })),
      spanId: rootSpanId,
      totalLatencyMs: totalTurnDurationMs,
    };

    options.onStreamEvent?.({ type: 'turn_complete', result: finalResult });
    agentTraceEmitter.emit('trace_event', {
      sessionId,
      type: 'turn_complete',
      totalLatencyMs: totalTurnDurationMs,
    });

    return finalResult;
  }

  async listUserSessions(userId: string) {
    return db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.updatedAt));
  }

  async getSessionMessages(userId: string, sessionId: string) {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
      .limit(1);

    if (!session) return null;

    return db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(asc(agentMessages.createdAt));
  }

  async listPendingActions(userId: string) {
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
}

export const agentOrchestratorService = new AgentOrchestratorService();
