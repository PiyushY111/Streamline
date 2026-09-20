import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyAiFailureReason } from '../services/ai/core/failure-classifier.js';
import { AllModelsExhaustedError } from '../utils/errors.js';
import { AgentOrchestratorService } from '../services/ai/agent/orchestrator.service.js';
import { aiCostGuardService } from '../services/ai/core/cost-guard.service.js';
import { setAiProvider } from '../services/ai/core/factory.js';
import type { AiProvider } from '../services/ai/core/types.js';
import { db } from '../db/index.js';
import * as memoryService from '../services/ai/memory/memory.service.js';

describe('classifyAiFailureReason', () => {
  it('classifies HTTP 429 as rate_limit', () => {
    expect(classifyAiFailureReason({ status: 429, message: 'Too many requests' })).toBe('rate_limit');
  });

  it('classifies quota/resource_exhausted messages as rate_limit', () => {
    expect(classifyAiFailureReason(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe('rate_limit');
  });

  it('classifies timeout messages as timeout', () => {
    expect(classifyAiFailureReason(new Error('Operation "gemini_generate_x" timed out after 15000ms'))).toBe(
      'timeout',
    );
  });

  it('classifies 5xx as server_error', () => {
    expect(classifyAiFailureReason({ status: 503, message: 'Service unavailable' })).toBe('server_error');
  });

  it('classifies 4xx (non-429) as client_error', () => {
    expect(classifyAiFailureReason({ status: 400, message: 'Bad request' })).toBe('client_error');
  });

  it('classifies a JSON-stringified SDK error (real @google/genai shape) by its nested status code', () => {
    // This is the actual shape seen from a live Gemini 403 (project access denied) —
    // the numeric status is nested inside a JSON-stringified `message`, not a top-level field.
    const err = new Error(
      JSON.stringify({ error: { code: 403, message: 'Your project has been denied access.', status: 'PERMISSION_DENIED' } }),
    );
    expect(classifyAiFailureReason(err)).toBe('client_error');
  });

  it('falls back to unknown for unrecognized errors', () => {
    expect(classifyAiFailureReason(new Error('something weird happened'))).toBe('unknown');
  });
});

describe('Orchestrator degrades gracefully instead of crashing when the AI provider fails', () => {
  const userId = 'u-cascade-test';
  const sessionId = 's-cascade-test';

  beforeEach(() => {
    vi.clearAllMocks();
    setAiProvider(null);
  });

  function mockDb(insertSpy: ReturnType<typeof vi.fn>) {
    vi.spyOn(db, 'select').mockImplementation((() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: sessionId, userId, title: 'Cascade Test' }]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    })) as any);

    vi.spyOn(db, 'insert').mockImplementation((table: any) => ({
      values: insertSpy,
    }) as any);

    vi.spyOn(db, 'update').mockImplementation((() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    })) as any);

    vi.spyOn(memoryService, 'searchMemory').mockResolvedValue([]);
  }

  it('when the AI cascade is fully exhausted, persists a degraded agentMessages row (not a crash) with the classified reason', async () => {
    const insertSpy = vi.fn().mockResolvedValue([{ id: 'msg-1' }]);
    mockDb(insertSpy);

    vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({
      isTripped: false,
      tokensToday: 0,
      costTodayUsd: 0,
    });

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn().mockRejectedValue(
        new AllModelsExhaustedError(['gemini-3.5-flash-lite', 'gemini-3.6-flash'], 'rate limited', 'rate_limit', [
          { model: 'gemini-3.5-flash-lite', reason: 'rate_limit' },
          { model: 'gemini-3.6-flash', reason: 'rate_limit' },
        ]),
      ),
    };
    setAiProvider(mockProvider);

    const orchestrator = new AgentOrchestratorService();

    // Must not throw — this used to propagate an unhandled 503 all the way to the route.
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'What are my tasks?');

    expect(result.text).toContain('degraded');
    expect(result.text).toContain('rate_limit');

    const degradedInsertCall = insertSpy.mock.calls.find((call) => call[0]?.degradedReason === 'rate_limit');
    expect(degradedInsertCall).toBeDefined();
    expect(degradedInsertCall?.[0]).toMatchObject({ role: 'model', degradedReason: 'rate_limit' });
  });

  it('persists a degraded agentMessages row with cost_guard_daily_limit when the daily circuit breaker trips', async () => {
    const insertSpy = vi.fn().mockResolvedValue([{ id: 'msg-1' }]);
    mockDb(insertSpy);

    vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({
      isTripped: true,
      reason: 'Daily AI cost limit reached ($0.55 / $0.50).',
      tokensToday: 240_000,
      costTodayUsd: 0.55,
    });

    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'What are my tasks?');

    expect(result.text).toContain('AI budget limit reached');
    const degradedInsertCall = insertSpy.mock.calls.find(
      (call) => call[0]?.degradedReason === 'cost_guard_daily_limit',
    );
    expect(degradedInsertCall).toBeDefined();
  });
});
