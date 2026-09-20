import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforcePolicy, executeApprovedAction } from '../services/ai/agent/policy.js';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';

/**
 * Targets branches in policy.ts that coverage-final.json showed as never executed:
 * idempotency-key deduplication on submission (a duplicate tool call with the same key must
 * return the existing pending action, not create a second one), unknown-tool-at-execution-time,
 * and — the highest-value gap — the atomic claim race-condition path in executeApprovedAction,
 * which is the same class of defense as the distributed lock added to token-manager.service.ts
 * this pass (preventing double-execution when two callers approve/execute concurrently), but
 * had zero coverage of its own.
 */
describe('Policy Engine: Coverage For Previously Untested Branches', () => {
  const userId = '00000000-4000-4000-a000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Idempotency-key deduplication on submission', () => {
    it('returns the existing pending action instead of creating a duplicate when the same idempotency key is reused', async () => {
      const existingPendingAction = {
        id: 'existing-pending-id',
        userId,
        toolName: 'send_email',
        idempotencyKey: 'idem-key-abc',
        impactPreview: { action: 'Send Email', to: 'x@example.com' },
      };

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([existingPendingAction]),
          }),
        }),
      } as any);

      const insertSpy = vi.fn();
      vi.spyOn(db, 'insert').mockImplementation(insertSpy as any);

      const outcome = await enforcePolicy(userId, null, {
        name: 'send_email',
        args: { to: 'x@example.com', subject: 'Hi', body: 'Hello', idempotencyKey: 'idem-key-abc' },
      });

      expect(outcome.kind).toBe('pending');
      if (outcome.kind === 'pending') {
        expect(outcome.pendingActionId).toBe('existing-pending-id');
      }
      // Deduplicated: must not have inserted a second pending_actions row.
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('proceeds to create a new pending action when the idempotency lookup finds nothing', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]), // no existing match
          }),
        }),
      } as any);

      const returningMock = vi.fn().mockResolvedValue([{ id: 'new-pending-id' }]);
      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({ returning: returningMock }),
      } as any);
      vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

      const outcome = await enforcePolicy(userId, null, {
        name: 'send_email',
        args: { to: 'x@example.com', subject: 'Hi', body: 'Hello', idempotencyKey: 'idem-key-new' },
      });

      expect(outcome.kind).toBe('pending');
      if (outcome.kind === 'pending') {
        expect(outcome.pendingActionId).toBe('new-pending-id');
      }
      expect(returningMock).toHaveBeenCalled();
    });
  });

  describe('executeApprovedAction: unknown tool at execution time', () => {
    it('throws if the tool was deleted/renamed from TOOL_REGISTRY between proposal and approval', async () => {
      const pendingAction = {
        id: 'action-1',
        userId,
        toolName: 'a_tool_that_no_longer_exists',
        toolArgs: {},
        status: 'pending',
        idempotencyKey: null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([pendingAction]),
          }),
        }),
      } as any);

      await expect(executeApprovedAction(userId, 'action-1')).rejects.toThrow(
        /Unknown tool: "a_tool_that_no_longer_exists"/,
      );
    });
  });

  describe('executeApprovedAction: atomic claim race condition', () => {
    it('when a concurrent caller already claimed and finished the action, returns the cached result instead of throwing', async () => {
      const pendingAction = {
        id: 'action-race',
        userId,
        toolName: 'create_task',
        toolArgs: { title: 'Race test' },
        status: 'pending',
        idempotencyKey: null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
      const alreadyExecutedByOtherCaller = {
        id: 'action-race',
        userId,
        status: 'executed',
        resultJson: { taskId: 'won-the-race' },
      };

      let selectCallCount = 0;
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                limit: vi.fn().mockImplementation(async () => {
                  selectCallCount++;
                  // 1st select: initial ownership fetch. 2nd select: re-check after losing the claim race.
                  return selectCallCount === 1 ? [pendingAction] : [alreadyExecutedByOtherCaller];
                }),
              }),
            }),
          }) as any,
      );

      // The atomic UPDATE ... WHERE status='pending' claim returns nothing, simulating that
      // another concurrent caller's claim already flipped the row's status first.
      vi.spyOn(db, 'update').mockReturnValue({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await executeApprovedAction(userId, 'action-race');
      expect(result).toEqual({ taskId: 'won-the-race' });
    });

    it('throws a clear error when the losing caller re-checks and the action is still mid-execution (not yet resolved)', async () => {
      const pendingAction = {
        id: 'action-race-2',
        userId,
        toolName: 'create_task',
        toolArgs: { title: 'Race test 2' },
        status: 'pending',
        idempotencyKey: null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
      const stillExecuting = { id: 'action-race-2', userId, status: 'executing' };

      let selectCallCount = 0;
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                limit: vi.fn().mockImplementation(async () => {
                  selectCallCount++;
                  return selectCallCount === 1 ? [pendingAction] : [stillExecuting];
                }),
              }),
            }),
          }) as any,
      );

      vi.spyOn(db, 'update').mockReturnValue({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(executeApprovedAction(userId, 'action-race-2')).rejects.toThrow(
        /Action already resolved with status: "executing"/,
      );
    });
  });
});
