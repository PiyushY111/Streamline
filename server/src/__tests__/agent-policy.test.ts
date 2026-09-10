import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforcePolicy, executeApprovedAction, rejectAction } from '../agent/policy.js';
import { db } from '../db/index.js';
import { pendingActions } from '../db/schema/index.js';
import { auditService } from '../services/audit.service.js';
import { TasksRepository, tasksRepository } from '../repositories/tasks.repository.js';
import { eventsRepository } from '../repositories/events.repository.js';
import { agentOrchestratorService } from '../services/ai/agent-orchestrator.service.js';
import { aiCostGuardService } from '../services/ai/cost-guard.service.js';
import { setAiProvider, getAiProvider } from '../services/ai/ai.factory.js';

describe('Agent Policy Engine & Human-in-the-Loop Safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiProvider(null);
  });

  describe('enforcePolicy - Dual Boundary Dispatch', () => {
    it('executes READ tools inline immediately', async () => {
      const mockTasks = [{ id: 't-1', title: 'Test Task', status: 'todo' }];
      vi.spyOn(TasksRepository.prototype, 'listUserTasks').mockResolvedValue(mockTasks as any);
      vi.spyOn(tasksRepository, 'listUserTasks').mockResolvedValue(mockTasks as any);
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'get_tasks',
        args: { status: 'todo' },
      });

      expect(outcome.kind).toBe('executed');
      if (outcome.kind === 'executed') {
        expect(outcome.result).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: 't-1', title: 'Test Task' })])
        );
      }
      expect(auditService.logAction).toHaveBeenCalledWith(
        'user-1',
        'agent.tool.read.get_tasks',
        expect.any(Object)
      );
    });

    it('strictly queues WRITE tools into pending_actions and NEVER executes inline', async () => {
      const mockPendingId = 'pending-action-uuid-1';
      const mockInsertReturning = [{
        id: mockPendingId,
        userId: 'user-1',
        toolName: 'create_task',
        status: 'pending',
      }];

      vi.spyOn(db, 'insert').mockImplementation(() => ({
        values: () => ({
          returning: vi.fn().mockResolvedValue(mockInsertReturning),
        }),
      } as any));
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);
      const createSpy = vi.spyOn(tasksRepository, 'create');

      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'create_task',
        args: {
          title: 'Deploy microservice',
          priority: 'high',
          importance: 0.9,
        },
        reasoning: 'User requested task creation',
      });

      // Crucial security invariant: tool is NOT executed inline
      expect(createSpy).not.toHaveBeenCalled();
      expect(outcome.kind).toBe('pending');
      if (outcome.kind === 'pending') {
        expect(outcome.pendingActionId).toBe(mockPendingId);
        expect(outcome.impactPreview).toHaveProperty('action', 'Create Task');
        expect(outcome.impactPreview).toHaveProperty('title', 'Deploy microservice');
        expect(outcome.impactPreview).toHaveProperty('priority', 'high');
      }
      expect(auditService.logAction).toHaveBeenCalledWith(
        'user-1',
        'agent.tool.queued.create_task',
        expect.objectContaining({ pendingActionId: mockPendingId })
      );
    });

    it('strictly queues SEND tools (e.g. send_email) into pending_actions', async () => {
      const mockPendingId = 'pending-email-uuid-2';
      vi.spyOn(db, 'insert').mockImplementation(() => ({
        values: () => ({
          returning: vi.fn().mockResolvedValue([{
            id: mockPendingId,
            userId: 'user-1',
            toolName: 'send_email',
            status: 'pending',
          }]),
        }),
      } as any));
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'send_email',
        args: {
          to: 'partner@example.com',
          subject: 'Partnership Agreement',
          body: 'Here is the agreement document attached.',
        },
      });

      expect(outcome.kind).toBe('pending');
      if (outcome.kind === 'pending') {
        expect(outcome.pendingActionId).toBe(mockPendingId);
        expect(outcome.impactPreview).toHaveProperty('action', 'Send External Email');
        expect(outcome.impactPreview).toHaveProperty('to', 'partner@example.com');
      }
    });

    it('rejects unknown tools (hallucinations or prompt injections)', async () => {
      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'execute_shell_command',
        args: { command: 'rm -rf /' },
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toContain('Unknown tool');
      }
    });

    it('rejects malformed arguments using Zod schema validation', async () => {
      // create_task requires a non-empty string title
      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'create_task',
        args: {
          title: '', // violates z.string().min(1)
        },
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toContain('Invalid arguments');
        expect(outcome.validationErrors).toBeDefined();
      }
    });

    it('handles read tool internal failures gracefully', async () => {
      vi.spyOn(TasksRepository.prototype, 'listUserTasks').mockRejectedValue(new Error('DB read connection timeout'));
      vi.spyOn(tasksRepository, 'listUserTasks').mockRejectedValue(new Error('DB read connection timeout'));

      const outcome = await enforcePolicy('user-1', 'session-1', {
        name: 'get_tasks',
        args: {},
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toContain('Tool execution failed: DB read connection timeout');
      }
    });
  });

  describe('executeApprovedAction - Atomic Execution & Validation', () => {
    it('executes approved action with row lock and updates status to executed', async () => {
      const mockAction = {
        id: 'action-101',
        userId: 'user-1',
        toolName: 'create_task',
        toolArgs: { title: 'Approved Task', priority: 'medium' },
        status: 'pending',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // valid
        idempotencyKey: null,
      };

      const mockCreatedTask = { id: 'created-task-1', title: 'Approved Task' };
      vi.spyOn(tasksRepository, 'create').mockResolvedValue(mockCreatedTask as any);
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      // Mock db.transaction
      const updateMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                for: vi.fn().mockResolvedValue([mockAction]),
              }),
            }),
          }),
          update: () => ({
            set: updateMock,
          }),
        };
        return callback(mockTx);
      });

      const result = await executeApprovedAction('user-1', 'action-101', { idempotencyKey: 'idem-1' });

      expect(result).toEqual(mockCreatedTask);
      expect(tasksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Approved Task',
        })
      );
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'executed',
          idempotencyKey: 'idem-1',
        })
      );
    });

    it('rejects approval if action belongs to another user (cross-user violation)', async () => {
      vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                for: vi.fn().mockResolvedValue([]), // No action found for this user
              }),
            }),
          }),
        };
        return callback(mockTx);
      });

      await expect(
        executeApprovedAction('hacker-user-99', 'action-101')
      ).rejects.toThrow('Pending action not found or not owned by user');
    });

    it('rejects approval if action is already resolved (e.g. executed or rejected)', async () => {
      const mockAction = {
        id: 'action-101',
        userId: 'user-1',
        toolName: 'create_task',
        toolArgs: { title: 'Already Done' },
        status: 'executed', // not pending
        expiresAt: new Date(Date.now() + 10000),
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                for: vi.fn().mockResolvedValue([mockAction]),
              }),
            }),
          }),
        };
        return callback(mockTx);
      });

      await expect(
        executeApprovedAction('user-1', 'action-101')
      ).rejects.toThrow('Action already resolved with status: "executed"');
    });

    it('rejects approval if action has expired (> 24h TTL)', async () => {
      const mockAction = {
        id: 'action-101',
        userId: 'user-1',
        toolName: 'create_task',
        toolArgs: { title: 'Old Task' },
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      };

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                for: vi.fn().mockResolvedValue([mockAction]),
              }),
            }),
          }),
          update: () => ({
            set: setMock,
          }),
        };
        return callback(mockTx);
      });

      await expect(
        executeApprovedAction('user-1', 'action-101')
      ).rejects.toThrow('This pending action has expired');
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
    });

    it('records failed status and re-throws when tool execution throws', async () => {
      const mockAction = {
        id: 'action-fail',
        userId: 'user-1',
        toolName: 'create_task',
        toolArgs: { title: 'Failing Task' },
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
      };

      vi.spyOn(tasksRepository, 'create').mockRejectedValue(new Error('Database foreign key failure'));
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });

      vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                for: vi.fn().mockResolvedValue([mockAction]),
              }),
            }),
          }),
          update: () => ({
            set: setMock,
          }),
        };
        return callback(mockTx);
      });

      await expect(
        executeApprovedAction('user-1', 'action-fail')
      ).rejects.toThrow('Database foreign key failure');

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorJson: expect.objectContaining({ message: 'Database foreign key failure' }),
        })
      );
    });
  });

  describe('rejectAction', () => {
    it('marks pending action as rejected', async () => {
      const mockAction = {
        id: 'act-rej',
        userId: 'user-1',
        toolName: 'send_email',
        status: 'pending',
      };

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockAction]),
          }),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([{ ...mockAction, status: 'rejected' }]),
          }),
        }),
      } as any);

      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      const rejected = await rejectAction('user-1', 'act-rej');
      expect(rejected.status).toBe('rejected');
      expect(auditService.logAction).toHaveBeenCalledWith(
        'user-1',
        'agent.tool.rejected',
        expect.objectContaining({ pendingActionId: 'act-rej' })
      );
    });
  });

  describe('AgentOrchestratorService Loop Safety', () => {
    it('enforces cost-guard budget before executing agent turn', async () => {
      vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({
        isTripped: true,
        reason: 'Daily token budget exceeded',
      } as any);

      const result = await agentOrchestratorService.runAgentTurn(
        'user-1',
        'session-1',
        'Hello copilot'
      );

      expect(result.text).toContain('budget limit reached');
      expect(result.pendingActions).toHaveLength(0);
    });

    it('terminates loop cleanly and does not loop infinitely when tool calls persist', async () => {
      vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({ isTripped: false } as any);
      vi.spyOn(aiCostGuardService, 'recordUsage').mockResolvedValue({ totalTokens: 10, costUsd: 0.00001, formattedCost: '0.000010' });

      // Mock session exists and message history
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 'session-1', userId: 'user-1', title: 'Existing Session' }]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-1' }]),
        }),
      } as any);

      // Model keeps proposing a tool on every turn
      const mockChatWithTools = vi.fn().mockResolvedValue({
        toolCalls: [{ name: 'get_tasks', args: {} }],
        finishReason: 'tool_calls',
      });

      setAiProvider({
        name: 'test-loop-provider',
        isAvailable: () => true,
        generateText: vi.fn(),
        generateJson: vi.fn(),
        chatWithTools: mockChatWithTools,
      } as any);

      vi.spyOn(TasksRepository.prototype, 'listUserTasks').mockResolvedValue([]);
      vi.spyOn(tasksRepository, 'listUserTasks').mockResolvedValue([]);
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      const response = await agentOrchestratorService.runAgentTurn(
        'user-1',
        'session-1',
        'What are my tasks?'
      );

      // Must terminate gracefully after MAX_TOOL_TURNS (5)
      expect(response).toBeDefined();
      expect(response.text).toContain('maximum allowed tool iterations');
    });
  });
});
