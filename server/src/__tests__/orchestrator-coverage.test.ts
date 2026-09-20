import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestratorService } from '../services/ai/agent/orchestrator.service.js';
import { aiCostGuardService } from '../services/ai/core/cost-guard.service.js';
import { setAiProvider } from '../services/ai/core/factory.js';
import type { AiProvider } from '../services/ai/core/types.js';
import { db } from '../db/index.js';
import * as memoryService from '../services/ai/memory/memory.service.js';
import * as policyModule from '../services/ai/agent/policy.js';

/**
 * Targets specific branches in orchestrator.service.ts that coverage-final.json showed as
 * NEVER executed by the existing test suite (orchestrator-loop-guard.test.ts only exercises
 * the duplicate-tool-call loop guard): the AI-provider-unavailable early return, the plain-text
 * final response path, and — most importantly — the orchestrator's own handling of policy
 * 'pending' and 'rejected' outcomes, including the untrusted-content security-notice tagging
 * on pending actions. That security notice is exactly the mechanism the UI uses to warn a human
 * reviewer that a proposed action was triggered by untrusted external content, and it had zero
 * test coverage before this.
 */
describe('Orchestrator: Coverage For Previously Untested Branches', () => {
  const userId = 'u-coverage-test';
  const sessionId = 's-coverage-test';

  beforeEach(() => {
    vi.clearAllMocks();
    setAiProvider(null);
  });

  function mockDbAndMemory() {
    vi.spyOn(db, 'select').mockImplementation((() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: sessionId, userId, title: 'Coverage Test' }]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    })) as any);

    vi.spyOn(db, 'insert').mockImplementation((() => ({
      values: vi.fn().mockResolvedValue([{ id: 'msg-1' }]),
    })) as any);

    vi.spyOn(db, 'update').mockImplementation((() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
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
  }

  it('returns a graceful unavailable message when no AI provider is configured, without crashing', async () => {
    mockDbAndMemory();
    setAiProvider(null); // getAiProvider() with no configured provider

    const unavailableProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => false, // simulates a provider instance that exists but isn't usable
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn(),
    };
    setAiProvider(unavailableProvider);

    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Hello?');

    expect(result.text).toContain('not available');
    expect(unavailableProvider.chatWithTools).not.toHaveBeenCalled();
  });

  it('handles a plain-text final response with no tool calls (Case A)', async () => {
    mockDbAndMemory();

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn().mockResolvedValue({
        text: 'Here is your summary for today.',
        usage: { promptTokens: 200, completionTokens: 30 },
      }),
    };
    setAiProvider(mockProvider);

    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Summarize my day');

    expect(result.text).toBe('Here is your summary for today.');
    expect(mockProvider.chatWithTools).toHaveBeenCalledTimes(1);
  });

  it('falls back to a default final message when the model returns neither text nor tool calls', async () => {
    mockDbAndMemory();

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      // No `usage` field either, forcing the estimateTokens(response.text || ...) fallback path.
      chatWithTools: vi.fn().mockResolvedValue({ text: null }),
    };
    setAiProvider(mockProvider);

    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Ping');

    expect(result.text).toBe('I have completed your request.');
  });

  it('tags a pending action with an untrusted-content security notice after a prior get_email read in the same turn', async () => {
    mockDbAndMemory();

    vi.spyOn(policyModule, 'enforcePolicy')
      .mockResolvedValueOnce({
        kind: 'executed',
        result: { id: 'email-1', sender: 'attacker@evil-domain.com', subject: 'x', body: 'y' },
      })
      .mockResolvedValueOnce({
        kind: 'pending',
        pendingActionId: 'pending-1',
        impactPreview: { action: 'Send Email', to: 'someone@example.com' },
      });

    const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    vi.spyOn(db, 'update').mockImplementation((() => ({ set: updateSetMock })) as any);

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
        if (callCount === 1) {
          return { toolCalls: [{ name: 'get_email', args: { emailId: 'email-1' } }], usage: { promptTokens: 10, completionTokens: 5 } };
        }
        if (callCount === 2) {
          return {
            toolCalls: [{ name: 'send_email', args: { to: 'someone@example.com', subject: 'x', body: 'y' } }],
            usage: { promptTokens: 10, completionTokens: 5 },
          };
        }
        return { text: 'Done.', usage: { promptTokens: 5, completionTokens: 2 } };
      }),
    };
    setAiProvider(mockProvider);

    const events: any[] = [];
    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Check my email and reply if needed', {
      onStreamEvent: (e) => events.push(e),
    });

    expect(result.pendingActions).toContain('pending-1');

    const queuedEvent = events.find((e) => e.type === 'action_queued');
    expect(queuedEvent).toBeDefined();
    expect(queuedEvent.impactPreview._securityNotice).toBeDefined();
    expect(queuedEvent.impactPreview._securityNotice.untrustedContentTriggered).toBe(true);
    expect(queuedEvent.impactPreview._securityNotice.sourceSender).toBe('attacker@evil-domain.com');

    // The DB row itself must carry the security notice too (not just the stream event).
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        impactPreview: expect.objectContaining({
          _securityNotice: expect.objectContaining({ untrustedContentTriggered: true }),
        }),
      }),
    );
  });

  it('does NOT attach a security notice to a pending action when no untrusted content was read this turn', async () => {
    mockDbAndMemory();

    vi.spyOn(policyModule, 'enforcePolicy').mockResolvedValueOnce({
      kind: 'pending',
      pendingActionId: 'pending-2',
      impactPreview: { action: 'Create Task', title: 'Follow up' },
    });

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'create_task', args: { title: 'Follow up' } }],
          usage: { promptTokens: 10, completionTokens: 5 },
        })
        .mockResolvedValueOnce({ text: 'Queued for your approval.', usage: { promptTokens: 5, completionTokens: 2 } }),
    };
    setAiProvider(mockProvider);

    const events: any[] = [];
    const orchestrator = new AgentOrchestratorService();
    await orchestrator.runAgentTurn(userId, sessionId, 'Add a follow-up task', {
      onStreamEvent: (e) => events.push(e),
    });

    const queuedEvent = events.find((e) => e.type === 'action_queued');
    expect(queuedEvent).toBeDefined();
    expect(queuedEvent.impactPreview._securityNotice).toBeUndefined();
  });

  it('handles a policy "rejected" outcome gracefully and reports the reason via the stream', async () => {
    mockDbAndMemory();

    vi.spyOn(policyModule, 'enforcePolicy').mockResolvedValueOnce({
      kind: 'rejected',
      reason: 'Invalid arguments for tool "create_task": title: Required',
    });

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'create_task', args: {} }],
          usage: { promptTokens: 10, completionTokens: 5 },
        })
        .mockResolvedValueOnce({ text: 'I need a title to create that task.', usage: { promptTokens: 5, completionTokens: 2 } }),
    };
    setAiProvider(mockProvider);

    const events: any[] = [];
    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Add a task', {
      onStreamEvent: (e) => events.push(e),
    });

    const rejectedEvent = events.find((e) => e.type === 'tool_rejected');
    expect(rejectedEvent).toBeDefined();
    expect(rejectedEvent.reason).toContain('Invalid arguments');
    expect(result.pendingActions).toHaveLength(0);
  });

  it('classifies a non-AllModelsExhaustedError provider failure as reason "unknown" instead of crashing', async () => {
    mockDbAndMemory();

    const mockProvider: AiProvider = {
      name: 'mock',
      isAvailable: () => true,
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateStructuredJson: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn().mockRejectedValue(new Error('Totally unexpected provider crash')),
    };
    setAiProvider(mockProvider);

    const orchestrator = new AgentOrchestratorService();
    const result = await orchestrator.runAgentTurn(userId, sessionId, 'Hello?');

    expect(result.text).toContain('degraded');
    expect(result.text).toContain('unknown');
  });
});
