import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traceService } from '../services/trace.service.js';
import { redactSecrets, scrubString } from '../utils/redactor.js';
import { db } from '../db/index.js';
import { agentSessions, agentMessages, pendingActions, memories } from '../db/schema/index.js';

describe('Stage 5 — Observability, OpenTelemetry Tracing & Decision Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PII & Secret Redaction Engine', () => {
    it('redacts Google Gemini API keys from strings and payloads', () => {
      const input = 'Call made with key AIzaSyD98765432101234567890123456789012 in query';
      const output = scrubString(input);
      expect(output).toContain('[REDACTED_GOOGLE_API_KEY]');
      expect(output).not.toContain('AIzaSyD');
    });

    it('redacts OpenAI API keys from strings and payloads', () => {
      const input = 'Authorization failed for sk-abcdef1234567890abcdef1234567890abcdef12';
      const output = scrubString(input);
      expect(output).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(output).not.toContain('sk-abcdef');
    });

    it('redacts Bearer tokens from authorization strings', () => {
      const input = 'Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
      const output = scrubString(input);
      expect(output).toContain('Bearer [REDACTED_BEARER_TOKEN]');
    });

    it('redacts PostgreSQL passwords in connection URIs', () => {
      const input = 'Connecting to postgres://admin:SuperSecretPass123@neon.tech:5432/streamline';
      const output = scrubString(input);
      expect(output).toContain('postgres://[REDACTED_USER_PASSWORD]@[REDACTED_HOST]');
      expect(output).not.toContain('SuperSecretPass123');
    });

    it('recursively redacts nested objects and arrays', () => {
      const complexPayload = {
        session: 's-123',
        credentials: {
          apiKey: 'AIzaSyA12345678901234567890123456789012',
          token: 'Bearer sensitive-token-here',
        },
        tools: [{ name: 'send_email', args: { to: 'alex@example.com', password: 'my-email-pass' } }],
      };

      const redacted = redactSecrets(complexPayload) as any;
      expect(redacted.credentials.apiKey).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.credentials.token).toBe('[REDACTED_CREDENTIAL]');
      expect(redacted.tools[0].args.password).toBe('[REDACTED_CREDENTIAL]');
    });
  });

  describe('traceService.assembleTrace - Multi-Tenant Security & Timeline Assembly', () => {
    it('strictly enforces multi-tenant boundary and rejects cross-user trace requests', async () => {
      // Mock db returns empty because sessionId does not belong to requesting user
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await traceService.assembleTrace('user-attacker', 'session-owner-1');
      expect(result).toBeNull();
    });

    it('assembles chronological timeline steps and hierarchical OpenTelemetry spans', async () => {
      const mockSession = {
        id: 'session-uuid-1',
        userId: 'user-1',
        title: 'Schedule Team Sync',
        createdAt: new Date('2026-09-10T10:00:00Z'),
        updatedAt: new Date('2026-09-10T10:01:00Z'),
      };

      const mockMessages = [
        {
          id: 'msg-1',
          sessionId: 'session-uuid-1',
          role: 'user',
          content: 'Find free slots and schedule 30m with Sarah',
          spanId: 'span-u1',
          retrievedMemoryIds: ['mem-1'],
          createdAt: new Date('2026-09-10T10:00:01Z'),
        },
        {
          id: 'msg-2',
          sessionId: 'session-uuid-1',
          role: 'model',
          content: null,
          toolCalls: [{ name: 'find_free_slots', args: { date: '2026-09-11' } }],
          spanId: 'span-m1',
          parentSpanId: 'span-u1',
          latencyMs: 380,
          tokenPromptCount: 420,
          tokenCandidateCount: 85,
          costUsd: '0.000085',
          createdAt: new Date('2026-09-10T10:00:02Z'),
        },
        {
          id: 'msg-3',
          sessionId: 'session-uuid-1',
          role: 'tool',
          toolName: 'find_free_slots',
          toolResult: { slots: ['10:00', '14:30'] },
          spanId: 'span-t1',
          parentSpanId: 'span-m1',
          latencyMs: 95,
          createdAt: new Date('2026-09-10T10:00:03Z'),
        },
        {
          id: 'msg-4',
          sessionId: 'session-uuid-1',
          role: 'tool',
          toolName: 'create_calendar_event',
          toolResult: {
            status: 'queued_for_human_approval',
            pendingActionId: 'act-uuid-1',
            impactPreview: { title: '30m Sync with Sarah' },
          },
          spanId: 'span-t2',
          parentSpanId: 'span-m1',
          latencyMs: 25,
          createdAt: new Date('2026-09-10T10:00:04Z'),
        },
        {
          id: 'msg-5',
          sessionId: 'session-uuid-1',
          role: 'model',
          content: 'I found 2 free slots and queued a calendar invitation for your confirmation.',
          spanId: 'span-m2',
          parentSpanId: 'span-u1',
          latencyMs: 290,
          tokenPromptCount: 650,
          tokenCandidateCount: 110,
          costUsd: '0.000120',
          createdAt: new Date('2026-09-10T10:00:05Z'),
        },
      ];

      const mockActions = [
        {
          id: 'act-uuid-1',
          userId: 'user-1',
          sessionId: 'session-uuid-1',
          toolName: 'create_calendar_event',
          toolArgs: { title: '30m Sync with Sarah' },
          status: 'pending',
          reasoning: 'User requested scheduling meeting with Sarah',
          impactPreview: { title: '30m Sync with Sarah' },
          createdAt: new Date('2026-09-10T10:00:04Z'),
        },
      ];

      const mockMemories = [
        {
          id: 'mem-1',
          type: 'preference',
          content: 'Sarah prefers morning meetings before 11 AM.',
        },
      ];

      let selectCallCount = 0;
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: (table: any) => {
              selectCallCount++;
              return {
                where: () => {
                  if (table === agentSessions) {
                    return { limit: vi.fn().mockResolvedValue([mockSession]) };
                  }
                  if (table === agentMessages) {
                    return { orderBy: vi.fn().mockResolvedValue(mockMessages) };
                  }
                  if (table === pendingActions) {
                    return Promise.resolve(mockActions);
                  }
                  if (table === memories) {
                    return Promise.resolve(mockMemories);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          }) as any,
      );

      const trace = await traceService.assembleTrace('user-1', 'session-uuid-1');

      expect(trace).not.toBeNull();
      if (!trace) return;

      // Summary verification
      expect(trace.summary.sessionId).toBe('session-uuid-1');
      expect(trace.summary.sessionTitle).toBe('Schedule Team Sync');
      expect(trace.summary.toolCallsCount).toBe(2);
      expect(trace.summary.pendingActionsCount).toBe(1);
      expect(trace.summary.totalLatencyMs).toBe(380 + 95 + 25 + 290);

      // Step kinds verification
      const stepKinds = trace.timelineSteps.map((s) => s.kind);
      expect(stepKinds).toContain('user_message');
      expect(stepKinds).toContain('context_retrieved');
      expect(stepKinds).toContain('tool_call');
      expect(stepKinds).toContain('pending_action');
      expect(stepKinds).toContain('model_response');

      // Memory injection provenance verification
      const contextStep = trace.timelineSteps.find((s) => s.kind === 'context_retrieved');
      expect(contextStep).toBeDefined();
      expect(contextStep?.metadata?.memorySnippets?.[0]?.snippet).toContain('morning meetings');

      // Policy gate interception verification
      const pendingStep = trace.timelineSteps.find((s) => s.kind === 'pending_action');
      expect(pendingStep).toBeDefined();
      expect(pendingStep?.metadata?.status).toBe('pending');
      expect(pendingStep?.metadata?.actionId).toBe('act-uuid-1');

      // OpenTelemetry span hierarchy verification
      expect(trace.waterfallSpans.length).toBeGreaterThan(0);
      const interceptedSpan = trace.waterfallSpans.find((s) => s.statusCode === 'INTERCEPTED');
      expect(interceptedSpan).toBeDefined();
      expect(interceptedSpan?.attributes['agent.tool_name']).toBe('create_calendar_event');
    });

    it('updates pending step status to executed after action approval', async () => {
      const mockSession = {
        id: 'session-uuid-2',
        userId: 'user-1',
        title: 'Approve Task Action',
        createdAt: new Date('2026-09-10T10:00:00Z'),
        updatedAt: new Date('2026-09-10T10:01:00Z'),
      };

      const mockMessages = [
        {
          id: 'msg-p1',
          sessionId: 'session-uuid-2',
          role: 'tool',
          toolName: 'create_task',
          toolResult: {
            status: 'queued_for_human_approval',
            pendingActionId: 'act-2',
          },
          spanId: 'span-act-2',
          latencyMs: 15,
          createdAt: new Date('2026-09-10T10:00:02Z'),
        },
      ];

      const mockApprovedAction = [
        {
          id: 'act-2',
          userId: 'user-1',
          sessionId: 'session-uuid-2',
          toolName: 'create_task',
          status: 'executed',
          reasoning: 'Create follow up task',
          resultJson: { taskId: 'task-new-123' },
          createdAt: new Date('2026-09-10T10:00:02Z'),
        },
      ];

      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: (table: any) => ({
              where: () => {
                if (table === agentSessions) return { limit: vi.fn().mockResolvedValue([mockSession]) };
                if (table === agentMessages) return { orderBy: vi.fn().mockResolvedValue(mockMessages) };
                if (table === pendingActions) return Promise.resolve(mockApprovedAction);
                return Promise.resolve([]);
              },
            }),
          }) as any,
      );

      const trace = await traceService.assembleTrace('user-1', 'session-uuid-2');
      expect(trace).not.toBeNull();
      const step = trace?.timelineSteps[0];
      expect(step?.metadata?.status).toBe('executed');
      expect(step?.label).toContain('EXECUTED');
    });
  });

  describe('traceService.getAgentCostStats', () => {
    it('aggregates agent turn vs triage vs digest costs', async () => {
      const mockUsageBreakdown = [
        { operation: 'agent_turn', tokens: 12000, cost: '0.001850' },
        { operation: 'triage', tokens: 45000, cost: '0.004500' },
        { operation: 'digest', tokens: 8500, cost: '0.000950' },
      ];

      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                groupBy: vi.fn().mockResolvedValue(mockUsageBreakdown),
              }),
            }),
          }) as any,
      );

      const stats = await traceService.getAgentCostStats('user-1');
      expect(stats.last7Days.agentTurnCostUsd).toBe(0.00185);
      expect(stats.last7Days.triageCostUsd).toBe(0.0045);
      expect(stats.last7Days.digestCostUsd).toBe(0.00095);
      expect(stats.last7Days.operations).toHaveLength(3);
    });
  });
});
