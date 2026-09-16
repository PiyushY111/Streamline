import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiCostGuardService, AI_BUDGET_LIMITS } from '../services/ai/core/cost-guard.service.js';
import { db } from '../db/index.js';

describe('AI Cost Guard & Circuit Breaker Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Cost Calculation', () => {
    it('should calculate cost accurately for gemini-3.5-flash-lite', () => {
      // 1,000,000 prompt tokens = $0.075, 1,000,000 completion = $0.30
      const { costUsd, formattedCost } = aiCostGuardService.calculateCost('gemini-3.5-flash-lite', 100_000, 10_000);

      const expectedPromptCost = (100_000 / 1_000_000) * 0.075; // 0.0075
      const expectedCompCost = (10_000 / 1_000_000) * 0.3; // 0.003
      const expectedTotal = expectedPromptCost + expectedCompCost; // 0.0105

      expect(costUsd).toBeCloseTo(expectedTotal, 5);
      expect(formattedCost).toBe('0.010500');
    });

    it('should calculate cost accurately for gemini-3.6-flash', () => {
      const { costUsd } = aiCostGuardService.calculateCost('gemini-3.6-flash', 50_000, 50_000);
      const expected = (50_000 / 1_000_000) * 0.1 + (50_000 / 1_000_000) * 0.4;
      expect(costUsd).toBeCloseTo(expected, 5);
    });

    it('should estimate token count from string length (~4 chars/token)', () => {
      expect(aiCostGuardService.estimateTokens('1234')).toBe(1);
      expect(aiCostGuardService.estimateTokens('12345678')).toBe(2);
      expect(aiCostGuardService.estimateTokens('')).toBe(0);
    });
  });

  describe('Circuit Breaker Logic', () => {
    it('should not trip circuit breaker when user is within budget limits', async () => {
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ totalTokens: 5_000, totalCost: '0.005' }]),
          }) as any,
      );

      const status = await aiCostGuardService.checkCircuitBreaker('user-1');
      expect(status.isTripped).toBe(false);
      expect(status.tokensToday).toBe(5_000);
      expect(status.costTodayUsd).toBe(0.005);
    });

    it('should trip circuit breaker when daily token limit is reached', async () => {
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnThis(),
            where: vi
              .fn()
              .mockResolvedValue([{ totalTokens: AI_BUDGET_LIMITS.DAILY_TOKEN_LIMIT + 100, totalCost: '0.20' }]),
          }) as any,
      );

      const status = await aiCostGuardService.checkCircuitBreaker('user-1');
      expect(status.isTripped).toBe(true);
      expect(status.reason).toContain('Daily AI token limit reached');
    });

    it('should trip circuit breaker when daily cost limit is reached', async () => {
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnThis(),
            where: vi
              .fn()
              .mockResolvedValue([
                { totalTokens: 10_000, totalCost: String(AI_BUDGET_LIMITS.DAILY_COST_LIMIT_USD + 0.1) },
              ]),
          }) as any,
      );

      const status = await aiCostGuardService.checkCircuitBreaker('user-1');
      expect(status.isTripped).toBe(true);
      expect(status.reason).toContain('Daily AI cost limit reached');
    });
  });

  describe('User Usage Stats Aggregation', () => {
    it('should return formatted usage summary with breakdown', async () => {
      let callCount = 0;
      vi.spyOn(db, 'select').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Today stats
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ tokens: 12_000, cost: '0.012' }]),
          } as any;
        } else if (callCount === 2) {
          // Monthly stats
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ tokens: 80_000, cost: '0.080' }]),
          } as any;
        } else {
          // Breakdown
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockResolvedValue([
              { operation: 'triage', tokens: 60_000, cost: '0.060' },
              { operation: 'reply_draft', tokens: 20_000, cost: '0.020' },
            ]),
          } as any;
        }
      });

      const stats = await aiCostGuardService.getUserUsageStats('user-1');
      expect(stats.today.tokens).toBe(12_000);
      expect(stats.today.costUsd).toBe(0.012);
      expect(stats.last30Days.tokens).toBe(80_000);
      expect(stats.breakdown).toHaveLength(2);
      expect(stats.circuitBreaker.isTripped).toBe(false);
    });
  });
});
