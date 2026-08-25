import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { connectedAccounts } from '../db/schema/index.js';
import { gmailSyncQueue, calendarSyncQueue } from '../queues/index.js';
import { logger } from '../utils/logger.js';

export function startSyncScheduler() {
  logger.info('⏰ Initializing 2-Minute Background Sync Cron Scheduler...');

  // Enqueue background sync jobs every 2 minutes (120,000 ms)
  setInterval(async () => {
    try {
      const activeAccounts = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.status, 'active'));

      if (activeAccounts.length === 0) return;

      logger.info({ count: activeAccounts.length }, '⏰ Cron Scheduler enqueuing background sync jobs...');

      for (const account of activeAccounts) {
        await gmailSyncQueue.add(
          'sync-gmail',
          { accountId: account.id },
          { jobId: `gmail-sync-${account.id}-${Date.now()}` }
        );

        await calendarSyncQueue.add(
          'sync-calendar',
          { accountId: account.id },
          { jobId: `calendar-sync-${account.id}-${Date.now()}` }
        );
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error in Background Sync Scheduler');
    }
  }, 2 * 60 * 1000);
}
