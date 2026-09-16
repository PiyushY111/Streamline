import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeToolFingerprint,
  AgentOrchestratorService,
  AgentLoopDetectedError,
} from '../services/ai/agent/orchestrator.service.js';
import { aiCostGuardService, AI_BUDGET_LIMITS } from '../services/ai/core/cost-guard.service.js';
import { setAiProvider } from '../services/ai/core/factory.js';
import type { AiProvider } from '../services/ai/core/types.js';
import { db } from '../db/index.js';
import * as memoryService from '../services/ai/memory/memory.service.js';

describe('Orchestrator Loop Guard & Resource Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiProvider(null);
  });

  describe('computeToolFingerprint', () => {
    it('produces identical fingerprints regardless of object key order', () => {
      const fp1 = computeToolFingerprint('get_tasks', { status: 'todo', limit: 10 });
      const fp2 = computeToolFingerprint('get_tasks', { limit: 10, status: 'todo' });

      expect(fp1).toBe(fp2);
      expect(fp1.startsWith('get_tasks:')).toBe(true);
    });

    it('produces different fingerprints for different arguments', () => {
      const fp1 = computeToolFingerprint('get_tasks', { status: 'todo' });
      const fp2 = computeToolFingerprint('get_tasks', { status: 'completed' });

      expect(fp1).not.toBe(fp2);
    });

    it('produces different fingerprints for different tools with same arguments', () => {
      const fp1 = computeToolFingerprint('get_tasks', { id: '123' });
      const fp2 = computeToolFingerprint('get_email', { id: '123' });

      expect(fp1).not.toBe(fp2);
    });
  });

  describe('Single-Turn Token Guard', () => {
    it('allows turns within budget and flags turns exceeding single-turn limit', () => {
      const normalTurn = aiCostGuardService.checkSingleTurnLimit(10_000);
      expect(normalTurn.isExceeded).toBe(false);

      const hugeTurn = aiCostGuardService.checkSingleTurnLimit(AI_BUDGET_LIMITS.SINGLE_TURN_TOKEN_LIMIT + 1);
      expect(hugeTurn.isExceeded).toBe(true);
      expect(hugeTurn.limit).toBe(50_000);
    });
  });

  describe('Orchestrator ReAct Loop Interception', () => {
    it('detects and halts execution on duplicate tool call in the same turn', async () => {
      const orchestrator = new AgentOrchestratorService();
      const userId = 'u-loop-test';
      const sessionId = 's-loop-test';

      // Mock database session lookup
      vi.spyOn(db, 'select').mockImplementation((() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: sessionId, userId, title: 'Loop Test' }]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      })) as any);

      vi.spyOn(db, 'insert').mockImplementation((() => ({
        values: vi.fn().mockResolvedValue([{ id: 'msg-1' }]),
      })) as any);

      vi.spyOn(db, 'update').mockImplementation((() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })) as any);

      vi.spyOn(memoryService, 'searchMemory').mockResolvedValue([]);
      vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({
        isTripped: false,
        tokensToday: 0,
        costTodayUsd: 0,
      });
      vi.spyOn(aiCostGuardService, 'recordUsage').mockResolvedValue({
        totalTokens: 50,
        costUsd: 0.0001,
        formattedCost: '0.000100',
      });

      // Mock provider that repeatedly asks to run the exact same tool
      let callCount = 0;
      const mockProvider: AiProvider = {
        name: 'mock',
        isAvailable: () => true,
        generateText: vi.fn(),
        streamText: vi.fn(),
        generateStructuredJson: vi.fn(),
        generateEmbedding: vi.fn(),
        chatWithTools: vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            text: null,
            toolCalls: [
              {
                id: `call-${callCount}`,
                name: 'get_tasks',
                args: { status: 'todo' },
              },
            ],
            usage: { promptTokens: 100, completionTokens: 50 },
          };
        }),
      };

      setAiProvider(mockProvider);

      const events: any[] = [];
      const result = await orchestrator.runAgentTurn(userId, sessionId, 'What are my tasks?', {
        onStreamEvent: (event) => events.push(event),
      });

      // Loop should terminate after seeing the duplicate fingerprint on turn 2
      expect(result.text).toContain('repetitive action loop');
      const rejectedEvent = events.find((e) => e.type === 'tool_rejected');
      expect(rejectedEvent).toBeDefined();
      expect(rejectedEvent?.reason).toContain('Loop detected');
    });
  });
});
