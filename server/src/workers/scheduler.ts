import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { connectedAccounts } from '../db/schema/index.js';
import { accountSyncQueue } from '../queues/index.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export const ACCOUNT_SYNC_TICK_SCHEDULER_ID = 'account-sync-tick-scheduler';
export const ACCOUNT_SYNC_TICK_JOB_NAME = 'sync-tick';
const TICK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Registers a BullMQ Job Scheduler that produces one 'sync-tick' job every 2 minutes.
 *
 * This replaces a prior in-process `setInterval` design, which had two real problems:
 * 1. It didn't survive a process restart — the schedule existed only in that process's memory,
 *    so a redeploy or crash silently stopped account syncing until the process came back up.
 * 2. Both `src/index.ts` (API server) and `src/worker.ts` (standalone worker process) called
 *    `startSyncScheduler()`, and each horizontally-scaled replica of either would run its own
 *    independent timer — N replicas meant N independent "is anyone due for sync?" checks firing
 *    close together, each racing to enqueue the same per-account jobs.
 *
 * A BullMQ Job Scheduler is a single shared definition stored in Redis, keyed by
 * `jobSchedulerId`. Calling `upsertJobScheduler` with the same ID from every replica's startup
 * converges to exactly ONE schedule (this is BullMQ's own idempotent upsert semantics — see
 * `scheduler.test.ts` for a real assertion against Redis, not just a mocked call), and BullMQ
 * produces exactly one 'sync-tick' job per interval regardless of how many replicas or Worker
 * instances are running. The schedule persists in Redis across restarts. Safe and idempotent to
 * call from every replica's startup path.
 */
export async function initAccountSyncScheduler(): Promise<void> {
  await accountSyncQueue.upsertJobScheduler(
    ACCOUNT_SYNC_TICK_SCHEDULER_ID,
    { every: TICK_INTERVAL_MS },
    { name: ACCOUNT_SYNC_TICK_JOB_NAME, data: {} },
  );
  logger.info(
    { schedulerId: ACCOUNT_SYNC_TICK_SCHEDULER_ID, intervalMs: TICK_INTERVAL_MS },
    '⏰ Account sync BullMQ job scheduler registered (Redis-backed, survives restarts, safe across replicas)',
  );
}

/**
 * Removes the shared Job Scheduler definition from Redis entirely.
 *
 * This is a CLUSTER-WIDE operation, not a per-replica one — do NOT call this from a single
 * replica's graceful shutdown path, or that one replica going down would disable account
 * syncing for every other replica still running. Only call this from an explicit
 * decommission/migration script, which is why it's not wired into `stopWorkers()`.
 */
export async function removeAccountSyncScheduler(): Promise<boolean> {
  return accountSyncQueue.removeJobScheduler(ACCOUNT_SYNC_TICK_SCHEDULER_ID);
}

/**
 * Handles a single 'sync-tick' job: finds active accounts and enqueues (or reuses) a
 * per-account sync job. This runs inside whichever replica's Worker instance actually claims
 * the tick job — BullMQ guarantees only one Worker across the whole cluster claims any given
 * job, so this fan-out logic itself never runs twice for the same tick even with N replicas.
 *
 * Per-account job IDs (`account-sync-${accountId}`) provide a second layer of safety: even if
 * a sync for some account is still in flight when the next tick fires, re-adding a job with the
 * same ID while an existing active/waiting/delayed job exists is a no-op skip below, so a slow
 * sync never gets double-enqueued either.
 */
export async function runAccountSyncTick(): Promise<void> {
  try {
    const activeAccounts = await db.select().from(connectedAccounts).where(eq(connectedAccounts.status, 'active'));
    if (activeAccounts.length === 0) return;

    logger.info({ count: activeAccounts.length }, '⏰ Account sync tick: enqueuing background sync jobs...');

    for (const account of activeAccounts) {
      try {
        const jobId = `account-sync-${account.id}`;
        const existingJob = await accountSyncQueue.getJob(jobId).catch(() => null);
        if (existingJob) {
          const state = await existingJob.getState().catch(() => null);
          if (state === 'active' || state === 'waiting' || state === 'delayed') {
            continue;
          }
        }

        await accountSyncQueue.add('sync-account', { accountId: account.id }, { jobId });
      } catch (queueErr: unknown) {
        const err = toError(queueErr);
        if (err.message.includes('max requests limit exceeded')) {
          // Seamlessly fallback to direct in-process sync when Upstash Redis is over quota
          const { syncGoogleAccountData } = await import('../services/google/google-sync.service.js');
          syncGoogleAccountData(account.id).catch((syncErr) => {
            logger.warn({ accountId: account.id, err: syncErr?.message }, 'Direct background sync warning');
          });
        } else {
          logger.warn({ accountId: account.id, err: err.message }, 'Could not enqueue account sync job');
        }
      }
    }
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    if (!err.message.includes('max requests limit exceeded')) {
      logger.error({ err: err.message }, 'Error in account sync tick handler');
    }
  }
}
