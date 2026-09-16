import { db } from '../../../db/index.js';
import { aiTokenUsage } from '../../../db/schema/index.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';

export interface ModelPricing {
  promptPerMillion: number;
  completionPerMillion: number;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  'gemini-3.5-flash-lite': { promptPerMillion: 0.075, completionPerMillion: 0.30 },
  'gemini-3.6-flash': { promptPerMillion: 0.10, completionPerMillion: 0.40 },
  'gemini-3.1-flash-lite': { promptPerMillion: 0.075, completionPerMillion: 0.30 },
  'gemini-3.7-flash': { promptPerMillion: 0.15, completionPerMillion: 0.60 },
  'gemini-3.1-pro-preview': { promptPerMillion: 1.25, completionPerMillion: 5.00 },
};

// Default budget limits per user
export const AI_BUDGET_LIMITS = {
  DAILY_TOKEN_LIMIT: 250_000,        // 250,000 tokens / day
  DAILY_COST_LIMIT_USD: 0.50,       // $0.50 / day per user
  SINGLE_TURN_TOKEN_LIMIT: 50_000,   // 50,000 tokens max per single turn / invocation
};

export type AiOperationType = 'triage' | 'reply_draft' | 'digest' | 'summary' | 'agent_turn' | 'tool_call';

export class AiCostGuardService {
  /**
   * Computes USD cost from token counts according to model pricing
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): { costUsd: number; formattedCost: string } {
    const pricing = MODEL_PRICING_TABLE[model] || { promptPerMillion: 0.10, completionPerMillion: 0.40 };
    const promptCost = (promptTokens / 1_000_000) * pricing.promptPerMillion;
    const completionCost = (completionTokens / 1_000_000) * pricing.completionPerMillion;
    const totalCost = promptCost + completionCost;

    return {
      costUsd: totalCost,
      formattedCost: totalCost.toFixed(6),
    };
  }

  /**
   * Approximate token count for strings when exact usage metadata is not returned by the provider
   * (Standard heuristic: ~4 characters per token in English)
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Persists token usage record in PostgreSQL
   */
  async recordUsage(params: {
    userId: string;
    model: string;
    operation: AiOperationType;
    promptTokens: number;
    completionTokens: number;
  }): Promise<{ totalTokens: number; costUsd: number; formattedCost: string }> {
    try {
      const { userId, model, operation, promptTokens, completionTokens } = params;
      const totalTokens = promptTokens + completionTokens;
      const { costUsd, formattedCost } = this.calculateCost(model, promptTokens, completionTokens);

      await db.insert(aiTokenUsage).values({
        userId,
        model,
        operation,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: formattedCost,
      });

      logger.info(
        { userId, model, operation, totalTokens, costUsd: formattedCost },
        'AI Token Usage recorded'
      );

      return { totalTokens, costUsd, formattedCost };
    } catch (rawErr: unknown) {
      const err = toError(rawErr);
      logger.warn({ err: err.message }, 'Failed to record AI token usage in database');
      const { costUsd, formattedCost } = this.calculateCost(params.model, params.promptTokens, params.completionTokens);
      return { totalTokens: params.promptTokens + params.completionTokens, costUsd, formattedCost };
    }
  }

  /**
   * Guards against runaway single-turn prompts or completions exceeding turn budget limit
   */
  checkSingleTurnLimit(tokensInTurn: number): { isExceeded: boolean; limit: number; tokensInTurn: number } {
    return {
      isExceeded: tokensInTurn >= AI_BUDGET_LIMITS.SINGLE_TURN_TOKEN_LIMIT,
      limit: AI_BUDGET_LIMITS.SINGLE_TURN_TOKEN_LIMIT,
      tokensInTurn,
    };
  }

  /**
   * Persists fine-grained per-tool execution token usage
   */
  async recordToolCallUsage(params: {
    userId: string;
    model: string;
    toolName: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<{ totalTokens: number; costUsd: number; formattedCost: string }> {
    return this.recordUsage({
      userId: params.userId,
      model: params.model,
      operation: 'tool_call',
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
    });
  }

  /**
   * Checks if a user has exceeded their daily AI token or cost budget
   */
  async checkCircuitBreaker(userId: string): Promise<{
    isTripped: boolean;
    reason?: string;
    tokensToday: number;
    costTodayUsd: number;
  }> {
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const records = await db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)`,
          totalCost: sql<string>`COALESCE(SUM(CAST(${aiTokenUsage.estimatedCostUsd} AS NUMERIC)), 0)`,
        })
        .from(aiTokenUsage)
        .where(
          and(
            eq(aiTokenUsage.userId, userId),
            gte(aiTokenUsage.createdAt, startOfDay)
          )
        );

      const tokensToday = Number(records[0]?.totalTokens || 0);
      const costTodayUsd = parseFloat(records[0]?.totalCost || '0');

      if (tokensToday >= AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT) {
        return {
          isTripped: true,
          reason: `Daily AI token limit reached (${tokensToday.toLocaleString()} / ${AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT.toLocaleString()} tokens). Non-critical operations throttled to heuristic fallback.`,
          tokensToday,
          costTodayUsd,
        };
      }

      if (costTodayUsd >= AI_BUDGET_LIMITS.DAILY_COST_LIMIT_USD) {
        return {
          isTripped: true,
          reason: `Daily AI cost limit reached ($${costTodayUsd.toFixed(4)} / $${AI_BUDGET_LIMITS.DAILY_COST_LIMIT_USD.toFixed(2)}).`,
          tokensToday,
          costTodayUsd,
        };
      }

      return {
        isTripped: false,
        tokensToday,
        costTodayUsd,
      };
    } catch (rawErr: unknown) {
      const err = toError(rawErr);
      logger.warn({ err: err.message }, 'Error checking AI circuit breaker, allowing request');
      return { isTripped: false, tokensToday: 0, costTodayUsd: 0 };
    }
  }

  /**
   * Retrieves aggregated token and cost analytics with unit economics for a user
   */
  async getUserUsageStats(userId: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const startOf30Days = new Date();
    startOf30Days.setDate(startOf30Days.getDate() - 30);

    const [todayStats, monthlyStats, operationsBreakdown] = await Promise.all([
      db
        .select({
          tokens: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)`,
          cost: sql<string>`COALESCE(SUM(CAST(${aiTokenUsage.estimatedCostUsd} AS NUMERIC)), 0)`,
        })
        .from(aiTokenUsage)
        .where(and(eq(aiTokenUsage.userId, userId), gte(aiTokenUsage.createdAt, startOfDay))),
      db
        .select({
          tokens: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)`,
          cost: sql<string>`COALESCE(SUM(CAST(${aiTokenUsage.estimatedCostUsd} AS NUMERIC)), 0)`,
        })
        .from(aiTokenUsage)
        .where(and(eq(aiTokenUsage.userId, userId), gte(aiTokenUsage.createdAt, startOf30Days))),
      db
        .select({
          operation: aiTokenUsage.operation,
          count: sql<number>`count(*)::int`,
          tokens: sql<number>`COALESCE(SUM(${aiTokenUsage.totalTokens}), 0)`,
          cost: sql<string>`COALESCE(SUM(CAST(${aiTokenUsage.estimatedCostUsd} AS NUMERIC)), 0)`,
        })
        .from(aiTokenUsage)
        .where(and(eq(aiTokenUsage.userId, userId), gte(aiTokenUsage.createdAt, startOf30Days)))
        .groupBy(aiTokenUsage.operation),
    ]);

    const tokensToday = Number(todayStats[0]?.tokens || 0);
    const costTodayUsd = parseFloat(todayStats[0]?.cost || '0');
    const tokens30Days = Number(monthlyStats[0]?.tokens || 0);
    const cost30DaysUsd = parseFloat(monthlyStats[0]?.cost || '0');

    // Calculate Unit Economics
    const triageOp = operationsBreakdown.find((b) => b.operation === 'triage');
    const sessionOp = operationsBreakdown.find((b) => b.operation === 'agent_turn');
    const toolOp = operationsBreakdown.find((b) => b.operation === 'tool_call');

    const triageCount = triageOp?.count || 0;
    const triageCost = parseFloat(triageOp?.cost || '0');
    const costPerEmailTriage = triageCount > 0 ? (triageCost / triageCount) : 0.0001;

    const sessionTurnCount = sessionOp?.count || 0;
    const sessionCost = parseFloat(sessionOp?.cost || '0');
    const costPerSession = sessionTurnCount > 0 ? (sessionCost / sessionTurnCount) : 0.0005;

    const toolCallCount = toolOp?.count || 0;
    const toolTokens = Number(toolOp?.tokens || 0);
    const tokensPerToolCall = toolCallCount > 0 ? Math.round(toolTokens / toolCallCount) : 150;

    return {
      today: {
        tokens: tokensToday,
        costUsd: costTodayUsd,
        tokenLimit: AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT,
        costLimitUsd: AI_BUDGET_LIMITS.DAILY_COST_LIMIT_USD,
        singleTurnLimit: AI_BUDGET_LIMITS.SINGLE_TURN_TOKEN_LIMIT,
        percentUsed: Math.min(100, (tokensToday / AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT) * 100),
      },
      last30Days: {
        tokens: tokens30Days,
        costUsd: cost30DaysUsd,
      },
      breakdown: operationsBreakdown.map((b) => ({
        operation: b.operation,
        count: b.count,
        tokens: Number(b.tokens),
        costUsd: parseFloat(b.cost),
      })),
      unitEconomics: {
        costPerEmailTriage: Number(costPerEmailTriage.toFixed(6)),
        costPerSession: Number(costPerSession.toFixed(6)),
        tokensPerToolCall,
      },
      circuitBreaker: {
        isTripped: tokensToday >= AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT || costTodayUsd >= AI_BUDGET_LIMITS.DAILY_COST_LIMIT_USD,
      },
    };
  }
}

export const aiCostGuardService = new AiCostGuardService();
