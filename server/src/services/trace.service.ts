import { db } from '../db/index.js';
import {
  agentSessions,
  agentMessages,
  pendingActions,
  aiTokenUsage,
  memories,
} from '../db/schema/index.js';
import { eq, and, asc, inArray, gte, sql } from 'drizzle-orm';
import { redactSecrets } from '../utils/redactor.js';
import { TOOL_REGISTRY, PermissionClass } from './ai/agent/tools/index.js';

export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'CLIENT' | 'SERVER';
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  statusCode: 'OK' | 'ERROR' | 'INTERCEPTED';
  statusMessage?: string;
  attributes: {
    'gen_ai.system'?: string;
    'gen_ai.request.model'?: string;
    'gen_ai.usage.prompt_tokens'?: number;
    'gen_ai.usage.completion_tokens'?: number;
    'gen_ai.usage.total_tokens'?: number;
    'gen_ai.usage.estimated_cost_usd'?: number;
    'agent.step_kind': 'user_message' | 'context_retrieved' | 'tool_call' | 'pending_action' | 'model_response';
    'agent.tool_name'?: string;
    'agent.permission_class'?: PermissionClass;
    'agent.recalled_memory_ids'?: string[];
    'agent.untrusted_content_detected'?: boolean;
    'agent.action_id'?: string;
    'agent.action_status'?: string;
  };
}

export interface TraceStep {
  id: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: string;
  kind: 'user_message' | 'context_retrieved' | 'tool_call' | 'pending_action' | 'model_response';
  label: string;
  detail: unknown;
  latencyMs?: number;
  metadata?: {
    permissionClass?: PermissionClass;
    actionId?: string;
    status?: string;
    memorySnippets?: Array<{ id: string; type: string; snippet: string }>;
    tokens?: { prompt: number; completion: number; total: number };
    costUsd?: string;
    model?: string;
    untrustedContentWarning?: boolean;
    reasoning?: string;
    impactPreview?: Record<string, unknown>;
  };
}

export interface TraceSummary {
  sessionId: string;
  sessionTitle: string;
  totalCostUsd: number;
  totalTokens: number;
  totalLatencyMs: number;
  modelLatencyMs: number;
  toolLatencyMs: number;
  stepCount: number;
  toolCallsCount: number;
  pendingActionsCount: number;
  hasUntrustedContentWarning: boolean;
  createdAt: string;
  updatedAt: string;
  costDecomposition: {
    systemPromptTokens: number;
    memoryContextTokens: number;
    historyTokens: number;
    completionTokens: number;
    totalCostFormatted: string;
  };
}

export interface SessionTraceResponse {
  summary: TraceSummary;
  timelineSteps: TraceStep[];
  waterfallSpans: OTelSpan[];
}

export class TraceService {
  /**
   * Assembles an OpenTelemetry-compliant trace timeline and waterfall graph
   * for a specific session, strictly scoped to the requesting user.
   */
  async assembleTrace(userId: string, sessionId: string): Promise<SessionTraceResponse | null> {
    // 1. Multi-Tenant Authorization Gate
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
      .limit(1);

    if (!session) {
      return null;
    }

    // 2. Query all messages and pending actions for this session
    const [messages, actions] = await Promise.all([
      db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.sessionId, sessionId))
        .orderBy(asc(agentMessages.createdAt)),
      db
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.sessionId, sessionId)),
    ]);

    // 3. Resolve all retrieved memory IDs to extract provenance fact snippets
    const allMemoryIds = new Set<string>();
    for (const m of messages) {
      if (m.retrievedMemoryIds && Array.isArray(m.retrievedMemoryIds)) {
        for (const mid of m.retrievedMemoryIds) {
          allMemoryIds.add(mid);
        }
      }
    }

    const memoryLookup: Record<string, { id: string; type: string; snippet: string }> = {};
    if (allMemoryIds.size > 0) {
      const memoryRows = await db
        .select()
        .from(memories)
        .where(inArray(memories.id, Array.from(allMemoryIds)));

      for (const row of memoryRows) {
        memoryLookup[row.id] = {
          id: row.id,
          type: row.type,
          snippet: row.content.length > 90 ? `${row.content.slice(0, 90)}...` : row.content,
        };
      }
    }

    // 4. Build action lookup map by toolName or actionId
    const actionByToolId: Record<string, typeof actions[0]> = {};
    for (const act of actions) {
      actionByToolId[act.id] = act;
    }

    const timelineSteps: TraceStep[] = [];
    const waterfallSpans: OTelSpan[] = [];

    let totalModelLatency = 0;
    let totalToolLatency = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalEstimatedCost = 0;
    let hasUntrustedContentWarning = false;
    let toolCallsCount = 0;

    const baseSessionTimeMs = session.createdAt.getTime();

    // 5. Traverse messages to build chronological timeline & OTel spans
    for (const msg of messages) {
      const msgTimeMs = msg.createdAt.getTime();
      const relativeOffsetMs = Math.max(0, msgTimeMs - baseSessionTimeMs);
      const spanId = msg.spanId || msg.id.slice(0, 8);
      const parentSpanId = msg.parentSpanId || undefined;
      const latency = msg.latencyMs ?? 0;

      if (msg.role === 'user') {
        timelineSteps.push({
          id: msg.id,
          spanId,
          timestamp: msg.createdAt.toISOString(),
          kind: 'user_message',
          label: 'User Prompt',
          detail: msg.content,
        });

        waterfallSpans.push({
          traceId: sessionId,
          spanId,
          name: 'user.message_input',
          kind: 'SERVER',
          startTimeMs: relativeOffsetMs,
          endTimeMs: relativeOffsetMs + 5,
          durationMs: 5,
          statusCode: 'OK',
          attributes: {
            'agent.step_kind': 'user_message',
          },
        });

        // If memories were recalled on this turn, add a Context Retrieved step
        if (msg.retrievedMemoryIds && msg.retrievedMemoryIds.length > 0) {
          const recalledSnippets = msg.retrievedMemoryIds
            .map((id) => memoryLookup[id])
            .filter(Boolean);

          timelineSteps.push({
            id: `mem-${msg.id}`,
            spanId: `m-${spanId}`,
            parentSpanId: spanId,
            timestamp: msg.createdAt.toISOString(),
            kind: 'context_retrieved',
            label: `Semantic Memory Recall (${recalledSnippets.length} facts injected)`,
            detail: recalledSnippets,
            metadata: {
              memorySnippets: recalledSnippets,
            },
          });

          waterfallSpans.push({
            traceId: sessionId,
            spanId: `m-${spanId}`,
            parentSpanId: spanId,
            name: 'memory.vector_recall',
            kind: 'INTERNAL',
            startTimeMs: relativeOffsetMs + 6,
            endTimeMs: relativeOffsetMs + 45,
            durationMs: 39,
            statusCode: 'OK',
            attributes: {
              'agent.step_kind': 'context_retrieved',
              'agent.recalled_memory_ids': msg.retrievedMemoryIds,
            },
          });
        }
      }

      if (msg.role === 'model') {
        totalModelLatency += latency;
        totalPromptTokens += msg.tokenPromptCount || 0;
        totalCompletionTokens += msg.tokenCandidateCount || 0;
        if (msg.costUsd) {
          totalEstimatedCost += parseFloat(msg.costUsd);
        }

        if (msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
          timelineSteps.push({
            id: msg.id,
            spanId,
            parentSpanId,
            timestamp: msg.createdAt.toISOString(),
            kind: 'model_response',
            label: `Model Decision (${msg.toolCalls.length} tools planned)`,
            detail: msg.toolCalls,
            latencyMs: latency,
            metadata: {
              tokens: {
                prompt: msg.tokenPromptCount || 0,
                completion: msg.tokenCandidateCount || 0,
                total: (msg.tokenPromptCount || 0) + (msg.tokenCandidateCount || 0),
              },
              costUsd: msg.costUsd || '0.000000',
            },
          });

          waterfallSpans.push({
            traceId: sessionId,
            spanId,
            parentSpanId,
            name: 'ai.plan_with_tools',
            kind: 'CLIENT',
            startTimeMs: relativeOffsetMs,
            endTimeMs: relativeOffsetMs + latency,
            durationMs: latency,
            statusCode: 'OK',
            attributes: {
              'gen_ai.system': 'gemini',
              'gen_ai.request.model': 'gemini-3.5-flash-lite',
              'gen_ai.usage.prompt_tokens': msg.tokenPromptCount || 0,
              'gen_ai.usage.completion_tokens': msg.tokenCandidateCount || 0,
              'gen_ai.usage.total_tokens': (msg.tokenPromptCount || 0) + (msg.tokenCandidateCount || 0),
              'gen_ai.usage.estimated_cost_usd': parseFloat(msg.costUsd || '0'),
              'agent.step_kind': 'model_response',
            },
          });
        } else if (msg.content) {
          timelineSteps.push({
            id: msg.id,
            spanId,
            parentSpanId,
            timestamp: msg.createdAt.toISOString(),
            kind: 'model_response',
            label: 'Agent Response',
            detail: msg.content,
            latencyMs: latency,
            metadata: {
              tokens: {
                prompt: msg.tokenPromptCount || 0,
                completion: msg.tokenCandidateCount || 0,
                total: (msg.tokenPromptCount || 0) + (msg.tokenCandidateCount || 0),
              },
              costUsd: msg.costUsd || '0.000000',
            },
          });

          waterfallSpans.push({
            traceId: sessionId,
            spanId,
            parentSpanId,
            name: 'ai.generate_response',
            kind: 'CLIENT',
            startTimeMs: relativeOffsetMs,
            endTimeMs: relativeOffsetMs + latency,
            durationMs: latency,
            statusCode: 'OK',
            attributes: {
              'gen_ai.system': 'gemini',
              'gen_ai.request.model': 'gemini-3.5-flash-lite',
              'gen_ai.usage.prompt_tokens': msg.tokenPromptCount || 0,
              'gen_ai.usage.completion_tokens': msg.tokenCandidateCount || 0,
              'gen_ai.usage.total_tokens': (msg.tokenPromptCount || 0) + (msg.tokenCandidateCount || 0),
              'gen_ai.usage.estimated_cost_usd': parseFloat(msg.costUsd || '0'),
              'agent.step_kind': 'model_response',
            },
          });
        }
      }

      if (msg.role === 'tool') {
        toolCallsCount++;
        totalToolLatency += latency;

        const toolName = msg.toolName || 'unknown_tool';
        const toolDef = TOOL_REGISTRY[toolName];
        const permissionClass = toolDef?.permissionClass || 'read';

        const resultObj = msg.toolResult as Record<string, any> | null;
        const isQueued = resultObj?.status === 'queued_for_human_approval';
        const pendingActionId = resultObj?.pendingActionId;
        const liveAction = pendingActionId ? actionByToolId[pendingActionId] : null;

        if (isQueued || liveAction) {
          const actionStatus = liveAction?.status || 'pending';
          const impactPreview = liveAction?.impactPreview || resultObj?.impactPreview || {};
          const securityNotice = impactPreview?._securityNotice;
          if (securityNotice?.untrustedContentTriggered) {
            hasUntrustedContentWarning = true;
          }

          timelineSteps.push({
            id: msg.id,
            spanId,
            parentSpanId,
            timestamp: msg.createdAt.toISOString(),
            kind: 'pending_action',
            label: `Policy Intercepted: ${toolName} (${actionStatus.toUpperCase()})`,
            detail: {
              actionId: liveAction?.id || pendingActionId,
              toolName,
              toolArgs: liveAction?.toolArgs,
              status: actionStatus,
              reasoning: liveAction?.reasoning || 'Proposed by agent awaiting confirmation',
              impactPreview,
              result: liveAction?.resultJson,
            },
            latencyMs: latency,
            metadata: {
              permissionClass,
              actionId: liveAction?.id || pendingActionId,
              status: actionStatus,
              untrustedContentWarning: !!securityNotice?.untrustedContentTriggered,
              reasoning: liveAction?.reasoning || undefined,
              impactPreview,
            },
          });

          waterfallSpans.push({
            traceId: sessionId,
            spanId,
            parentSpanId,
            name: `policy.intercept.${toolName}`,
            kind: 'INTERNAL',
            startTimeMs: relativeOffsetMs,
            endTimeMs: relativeOffsetMs + latency,
            durationMs: latency,
            statusCode: 'INTERCEPTED',
            statusMessage: 'Held at dual-boundary policy gate for human approval',
            attributes: {
              'agent.step_kind': 'pending_action',
              'agent.tool_name': toolName,
              'agent.permission_class': permissionClass,
              'agent.action_id': liveAction?.id || pendingActionId,
              'agent.action_status': actionStatus,
              'agent.untrusted_content_detected': !!securityNotice?.untrustedContentTriggered,
            },
          });
        } else {
          timelineSteps.push({
            id: msg.id,
            spanId,
            parentSpanId,
            timestamp: msg.createdAt.toISOString(),
            kind: 'tool_call',
            label: `Executed Tool: ${toolName}`,
            detail: redactSecrets(msg.toolResult),
            latencyMs: latency,
            metadata: {
              permissionClass,
            },
          });

          waterfallSpans.push({
            traceId: sessionId,
            spanId,
            parentSpanId,
            name: `tool.execute.${toolName}`,
            kind: 'CLIENT',
            startTimeMs: relativeOffsetMs,
            endTimeMs: relativeOffsetMs + latency,
            durationMs: latency,
            statusCode: 'OK',
            attributes: {
              'agent.step_kind': 'tool_call',
              'agent.tool_name': toolName,
              'agent.permission_class': permissionClass,
            },
          });
        }
      }
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalLatency = totalModelLatency + totalToolLatency;

    // 6. Cost decomposition metrics
    const systemPromptEstimate = Math.min(totalPromptTokens, 450);
    const memoryContextEstimate = allMemoryIds.size > 0 ? Math.min(totalPromptTokens - systemPromptEstimate, allMemoryIds.size * 90) : 0;
    const historyEstimate = Math.max(0, totalPromptTokens - systemPromptEstimate - memoryContextEstimate);

    const summary: TraceSummary = {
      sessionId,
      sessionTitle: session.title || 'Agent Interaction Session',
      totalCostUsd: Number(totalEstimatedCost.toFixed(6)),
      totalTokens,
      totalLatencyMs: totalLatency,
      modelLatencyMs: totalModelLatency,
      toolLatencyMs: totalToolLatency,
      stepCount: timelineSteps.length,
      toolCallsCount,
      pendingActionsCount: actions.length,
      hasUntrustedContentWarning,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      costDecomposition: {
        systemPromptTokens: systemPromptEstimate,
        memoryContextTokens: memoryContextEstimate,
        historyTokens: historyEstimate,
        completionTokens: totalCompletionTokens,
        totalCostFormatted: `$${totalEstimatedCost.toFixed(6)}`,
      },
    };

    return {
      summary,
      timelineSteps,
      waterfallSpans,
    };
  }

  /**
   * Aggregates weekly and monthly AI spend for the cost governance dashboard
   */
  async getAgentCostStats(userId: string) {
    const startOf7Days = new Date();
    startOf7Days.setDate(startOf7Days.getDate() - 7);

    const startOf30Days = new Date();
    startOf30Days.setDate(startOf30Days.getDate() - 30);

    const [recentBreakdown, sessionsCount] = await Promise.all([
      db
        .select({
          operation: aiTokenUsage.operation,
          tokens: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)`,
          cost: sql<string>`COALESCE(SUM(CAST(${aiTokenUsage.estimatedCostUsd} AS NUMERIC)), 0)`,
        })
        .from(aiTokenUsage)
        .where(and(eq(aiTokenUsage.userId, userId), gte(aiTokenUsage.createdAt, startOf7Days)))
        .groupBy(aiTokenUsage.operation),
      db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(agentSessions)
        .where(eq(agentSessions.userId, userId)),
    ]);

    const totalSessions = Number(sessionsCount[0]?.count || 0);
    let agentTurnCost = 0;
    let triageCost = 0;
    let digestCost = 0;

    for (const b of recentBreakdown) {
      const costNum = parseFloat(b.cost);
      if (b.operation === 'agent_turn') agentTurnCost += costNum;
      else if (b.operation === 'triage') triageCost += costNum;
      else if (b.operation === 'digest') digestCost += costNum;
    }

    return {
      totalSessions,
      last7Days: {
        agentTurnCostUsd: Number(agentTurnCost.toFixed(6)),
        triageCostUsd: Number(triageCost.toFixed(6)),
        digestCostUsd: Number(digestCost.toFixed(6)),
        operations: recentBreakdown.map((r) => ({
          operation: r.operation,
          tokens: Number(r.tokens),
          costUsd: parseFloat(r.cost),
        })),
      },
    };
  }
}

export const traceService = new TraceService();
