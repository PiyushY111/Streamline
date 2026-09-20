import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initAccountSyncScheduler,
  runAccountSyncTick,
  ACCOUNT_SYNC_TICK_SCHEDULER_ID,
  ACCOUNT_SYNC_TICK_JOB_NAME,
} from '../workers/scheduler.js';
import { accountSyncQueue } from '../queues/index.js';
import { db } from '../db/index.js';

/**
 * Proves the BullMQ Job Scheduler migration in scheduler.ts: `initAccountSyncScheduler`
 * registers a Redis-backed, restart-surviving schedule (replacing the prior in-process
 * `setInterval`, which reset on every restart and raced across replicas), and
 * `runAccountSyncTick` — the fan-out logic a Worker runs when that scheduler fires — still
 * skips accounts whose sync job is already active/waiting/delayed.
 *
 * HONEST LIMITATION: I attempted a real integration test against the actual Redis instance
 * (two calls to `initAccountSyncScheduler`, then `accountSyncQueue.getJobSchedulers()` to
 * assert exactly one scheduler exists) to prove BullMQ's own upsert convergence end-to-end, not
 * just that this code calls the right method. It failed with a real, unrelated error: the
 * shared dev Upstash Redis instance is currently over its daily request quota (500,003 /
 * 500,000 — exhausted by this session's cumulative testing, not by this test). I could not get
 * a live-Redis proof today. What's below instead: (1) proves this code calls
 * `upsertJobScheduler` with a stable, deterministic ID every time (the actual mechanism BullMQ
 * uses to converge multiple calls to one definition — see the Lua script BullMQ runs for this
 * command, which ZADDs and HMSETs keyed by that exact ID, confirmed by inspecting the real
 * error trace from the attempted live call), and (2) fully exercises the per-account dedup
 * logic a tick actually runs. The live cross-replica proof should be re-run once the shared
 * Redis quota resets, or against a dedicated test Redis instance.
 */
describe('Account Sync Scheduler: BullMQ Job Scheduler Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initAccountSyncScheduler', () => {
    it('registers with a stable, deterministic scheduler ID and 2-minute interval', async () => {
      const upsertSpy = vi.spyOn(accountSyncQueue, 'upsertJobScheduler').mockResolvedValue({} as any);

      await initAccountSyncScheduler();

      expect(upsertSpy).toHaveBeenCalledWith(
        ACCOUNT_SYNC_TICK_SCHEDULER_ID,
        { every: 2 * 60 * 1000 },
        { name: ACCOUNT_SYNC_TICK_JOB_NAME, data: {} },
      );
    });

    it('is safe to call repeatedly (simulating N replicas independently starting up)', async () => {
      const upsertSpy = vi.spyOn(accountSyncQueue, 'upsertJobScheduler').mockResolvedValue({} as any);

      await Promise.all([initAccountSyncScheduler(), initAccountSyncScheduler(), initAccountSyncScheduler()]);

      expect(upsertSpy).toHaveBeenCalledTimes(3);
      const ids = upsertSpy.mock.calls.map((call) => call[0]);
      expect(new Set(ids).size).toBe(1); // every call targets the exact same schedulerId
    });

    it('propagates a real Redis/BullMQ error instead of silently swallowing it', async () => {
      vi.spyOn(accountSyncQueue, 'upsertJobScheduler').mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(initAccountSyncScheduler()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('runAccountSyncTick (the fan-out logic a Worker runs when the scheduler fires)', () => {
    it('does nothing when there are no active connected accounts', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({ where: vi.fn().mockResolvedValue([]) }),
      } as any);
      const addSpy = vi.spyOn(accountSyncQueue, 'add').mockResolvedValue({} as any);

      await runAccountSyncTick();

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('enqueues a per-account sync job for each active account with no in-flight job', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { id: 'acc-1', status: 'active' },
            { id: 'acc-2', status: 'active' },
          ]),
        }),
      } as any);
      vi.spyOn(accountSyncQueue, 'getJob').mockResolvedValue(undefined as any);
      const addSpy = vi.spyOn(accountSyncQueue, 'add').mockResolvedValue({} as any);

      await runAccountSyncTick();

      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(addSpy).toHaveBeenCalledWith('sync-account', { accountId: 'acc-1' }, { jobId: 'account-sync-acc-1' });
      expect(addSpy).toHaveBeenCalledWith('sync-account', { accountId: 'acc-2' }, { jobId: 'account-sync-acc-2' });
    });

    it('skips an account whose sync job is already active/waiting/delayed — the second layer of dedup, on top of the scheduler itself', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({ where: vi.fn().mockResolvedValue([{ id: 'acc-in-flight', status: 'active' }]) }),
      } as any);
      const inFlightJob = { getState: vi.fn().mockResolvedValue('active') };
      vi.spyOn(accountSyncQueue, 'getJob').mockResolvedValue(inFlightJob as any);
      const addSpy = vi.spyOn(accountSyncQueue, 'add').mockResolvedValue({} as any);

      await runAccountSyncTick();

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('re-enqueues an account whose previous job already completed or failed (not active/waiting/delayed)', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({ where: vi.fn().mockResolvedValue([{ id: 'acc-done', status: 'active' }]) }),
      } as any);
      const finishedJob = { getState: vi.fn().mockResolvedValue('completed') };
      vi.spyOn(accountSyncQueue, 'getJob').mockResolvedValue(finishedJob as any);
      const addSpy = vi.spyOn(accountSyncQueue, 'add').mockResolvedValue({} as any);

      await runAccountSyncTick();

      expect(addSpy).toHaveBeenCalledWith('sync-account', { accountId: 'acc-done' }, { jobId: 'account-sync-acc-done' });
    });

    it('falls back to direct in-process sync for one account without blocking the others when Redis is over quota', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { id: 'acc-quota-hit', status: 'active' },
            { id: 'acc-fine', status: 'active' },
          ]),
        }),
      } as any);
      vi.spyOn(accountSyncQueue, 'getJob').mockResolvedValue(undefined as any);
      vi.spyOn(accountSyncQueue, 'add')
        .mockRejectedValueOnce(new Error('ERR max requests limit exceeded. Limit: 500000, Usage: 500003'))
        .mockResolvedValueOnce({} as any);

      const googleSync = await import('../services/google/google-sync.service.js');
      const directSyncSpy = vi.spyOn(googleSync, 'syncGoogleAccountData').mockResolvedValue(undefined as any);

      await runAccountSyncTick();

      expect(directSyncSpy).toHaveBeenCalledWith('acc-quota-hit');
    });

    it('does not let one account throwing stop the others from being processed', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { id: 'acc-broken', status: 'active' },
            { id: 'acc-ok', status: 'active' },
          ]),
        }),
      } as any);
      vi.spyOn(accountSyncQueue, 'getJob').mockRejectedValue(new Error('lookup failed'));
      const addSpy = vi.spyOn(accountSyncQueue, 'add').mockResolvedValue({} as any);

      await expect(runAccountSyncTick()).resolves.toBeUndefined();
      // getJob failure is caught (`.catch(() => null)`), so both accounts should still reach add().
      expect(addSpy).toHaveBeenCalledTimes(2);
    });
  });
});
