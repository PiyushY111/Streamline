import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { connectedAccounts } from '../db/schema/index.js';
import { accountSyncQueue } from '../queues/index.js';
import { logger } from '../utils/logger.js';

let syncIntervalHandle: NodeJS.Timeout | null = null;

export function startSyncScheduler() {
  logger.info('⏰ Initializing 2-Minute Background Sync Cron Scheduler...');

  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
  }

  // Enqueue background sync jobs every 2 minutes (120,000 ms)
  syncIntervalHandle = setInterval(async () => {
    try {
      const activeAccounts = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.status, 'active'));

      if (activeAccounts.length === 0) return;

      logger.info({ count: activeAccounts.length }, '⏰ Cron Scheduler enqueuing background sync jobs...');

      for (const account of activeAccounts) {
        const jobId = `account-sync-${account.id}`;
        const existingJob = await accountSyncQueue.getJob(jobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'active' || state === 'waiting' || state === 'delayed') {
            continue;
          }
        }

        await accountSyncQueue.add(
          'sync-account',
          { accountId: account.id },
          { jobId }
        );
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error in Background Sync Scheduler');
    }
  }, 2 * 60 * 1000);
}

export function stopSyncScheduler(): void {
  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
    syncIntervalHandle = null;
    logger.info('🛑 Background Sync Cron Scheduler stopped.');
  }
}

