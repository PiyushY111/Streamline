import { describe, it, expect, vi, beforeEach } from 'vitest';
import { swarmSupervisor } from '../services/ai/agent/swarm/supervisor.js';
import { swarmCriticNode } from '../services/ai/agent/swarm/critic.js';
import { inboxSentryAgent } from '../services/ai/agent/swarm/agents/inbox-sentry.js';
import { calendarNegotiatorAgent } from '../services/ai/agent/swarm/agents/calendar-negotiator.js';
import { dagSchedulerAgent } from '../services/ai/agent/swarm/agents/dag-scheduler.js';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

// Mock AI Provider
vi.mock('../services/ai/core/factory.js', () => ({
  getAiProvider: vi.fn().mockReturnValue({
    isAvailable: () => true,
    generateStructuredJson: vi.fn().mockResolvedValue({
      passed: true,
      feedback: 'Plan is sound and complete with zero conflicts.',
    }),
    generateText: vi.fn().mockResolvedValue('All sub-agents completed their tasks successfully. 2 slots proposed.'),
  }),
}));

// Mock SSE
vi.mock('../services/sse.service.js', () => ({
  sseService: {
    emitToUser: vi.fn(),
  },
}));

describe('Multi-Agent Specialist Swarm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should decompose multi-intent goal and orchestrate specialist sub-agents', async () => {
    const userGoal = 'Check unread emails from Alex and find free calendar slots on Friday';
    const state = await swarmSupervisor.orchestrate('user-swarm-1', 'session-swarm-1', userGoal);

    expect(state.subTasks.length).toBeGreaterThanOrEqual(2);
    expect(state.subTasks.some((t) => t.role === 'inbox_sentry')).toBe(true);
    expect(state.subTasks.some((t) => t.role === 'calendar_negotiator')).toBe(true);

    // Critic should have evaluated the plan
    expect(state.criticPassed).toBe(true);
    expect(state.criticFeedback).toContain('Plan is sound');
    expect(state.finalAnswer).toContain('All sub-agents completed');
  });

  it('should run critic verification and validate state', async () => {
    const mockState: any = {
      userId: 'user-critic-1',
      sessionId: 'session-critic-1',
      userGoal: 'Schedule team sync',
      subTasks: [
        { id: '1', role: 'calendar_negotiator', title: 'Find slots', instruction: '', status: 'completed', output: { slots: ['2pm'] } },
      ],
      intermediateResults: { '1': { slots: ['2pm'] } },
      pendingActions: [],
    };

    const review = await swarmCriticNode.reviewState(mockState);
    expect(review.passed).toBe(true);
    expect(review.feedback).toBeDefined();
  });
});
