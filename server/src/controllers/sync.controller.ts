import { Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { accountSyncQueue } from '../queues/index.js';
import { logger } from '../utils/logger.js';

export async function triggerManualSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.status, 'active')));

    logger.info({ userId, count: userAccounts.length }, 'Triggering async manual sync for user accounts...');

    for (const acc of userAccounts) {
      const jobId = `account-sync-${acc.id}`;
      const existingJob = await accountSyncQueue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          continue;
        }
      }

      await accountSyncQueue.add(
        'sync-account',
        { accountId: acc.id },
        { jobId }
      );
    }

    res.status(202).json({ success: true, message: 'Sync queued successfully', accountsQueued: userAccounts.length });
  } catch (err: unknown) {
    logger.error({ err }, 'Error triggering manual sync');
    res.status(500).json({ error: 'Failed to trigger synchronization' });
  }
}
