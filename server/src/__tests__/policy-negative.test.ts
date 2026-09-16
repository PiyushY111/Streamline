import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforcePolicy, executeApprovedAction, rejectPendingAction } from '../services/ai/agent/policy.js';
import { db } from '../db/index.js';

describe('Policy Engine: Negative & Adversarial Security Suite', () => {
  const userIdA = '00000000-0000-4000-a000-000000000001';
  const userIdB = '00000000-0000-4000-a000-000000000002';
  const pendingActionId = '00000000-0000-4000-a000-000000000099';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hallucinated & Unregistered Tools', () => {
    it('rejects unregistered/synthetic tools cleanly with kind=rejected without throwing uncaught exceptions', async () => {
      const outcome = await enforcePolicy(userIdA, null, {
        name: 'delete_entire_database',
        args: { force: true, dropSchema: true },
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toContain('Unknown tool: "delete_entire_database"');
        expect(outcome.reason).toContain('not registered');
      }
    });

    it('rejects prototype pollution / arbitrary object key lookups', async () => {
      const outcome = await enforcePolicy(userIdA, null, {
        name: '__proto__',
        args: {},
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toContain('Unknown tool');
      }
    });
  });

  describe('Malformed Arguments & Schema Boundary Fuzzing', () => {
    it('rejects tool arguments with missing required fields and returns formatted validation errors', async () => {
      const outcome = await enforcePolicy(userIdA, null, {
        name: 'create_task',
        args: { priority: 'high' }, // Missing required 'title'
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toMatch(/title:/i);
        expect(outcome.validationErrors).toBeDefined();
      }
    });

    it('rejects send_email tool when recipient is missing or invalid', async () => {
      const outcome = await enforcePolicy(userIdA, null, {
        name: 'send_email',
        args: { subject: 'No recipient' }, // Missing 'to'
      });

      expect(outcome.kind).toBe('rejected');
      if (outcome.kind === 'rejected') {
        expect(outcome.reason).toMatch(/to:/i);
      }
    });
  });

  describe('IDOR Cross-Tenant Action Interception Prevention', () => {
    it('strictly forbids User B from executing an action belonging to User A', async () => {
      // Mock db returning action owned by user A
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]), // User B query returns empty because where(userId == userB)
          }),
        }),
      } as any);

      await expect(executeApprovedAction(userIdB, pendingActionId)).rejects.toThrow(/not found or not owned by user/i);
    });

    it('strictly forbids User B from rejecting an action belonging to User A', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(rejectPendingAction(userIdB, pendingActionId)).rejects.toThrow(/not found or not owned by user/i);
    });
  });

  describe('Race Condition Double-Execution Defense', () => {
    it('rejects execution when action is already in executed status', async () => {
      const alreadyExecutedAction = {
        id: pendingActionId,
        userId: userIdA,
        toolName: 'create_task',
        toolArgs: { title: 'Finished task' },
        status: 'executed',
        resultJson: { success: true },
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([alreadyExecutedAction]),
          }),
        }),
      } as any);

      await expect(executeApprovedAction(userIdA, pendingActionId)).rejects.toThrow(
        /Action already resolved with status: "executed"/i,
      );
    });

    it('rejects execution when action has expired past its 24h TTL', async () => {
      const expiredAction = {
        id: pendingActionId,
        userId: userIdA,
        toolName: 'send_email',
        toolArgs: { to: 'client@example.com', subject: 'Expired' },
        status: 'pending',
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
      };

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([expiredAction]),
          }),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.spyOn(db, 'update').mockReturnValue({
        set: updateSetMock,
      } as any);

      await expect(executeApprovedAction(userIdA, pendingActionId)).rejects.toThrow(
        /expired \(24h time limit exceeded\)/i,
      );

      expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
    });
  });
});
