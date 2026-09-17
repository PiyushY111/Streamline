import { Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { accountSyncQueue } from '../queues/index.js';
import { auditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';
import { UnauthorizedError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

import { syncGoogleAccountData } from '../services/google/google-sync.service.js';
import { delCache } from '../services/cache.service.js';

export const triggerManualSync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const userAccounts = await db
    .select()
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.status, 'active')));

  const shouldWait = req.query.wait === 'true' || req.query.fast === 'true';

  if (shouldWait) {
    logger.info({ userId, count: userAccounts.length }, 'Executing fast direct sync for user accounts...');
    if (userAccounts.length > 0) {
      await Promise.allSettled(userAccounts.map((acc) => syncGoogleAccountData(acc.id)));
      await delCache(`emails:${userId}:*`).catch(() => {});
    }

    await auditService
      .logAction(userId, 'sync.fast_completed', {
        accountsSynced: userAccounts.length,
      })
      .catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Fast sync completed successfully',
      accountsSynced: userAccounts.length,
    });
  }

  logger.info({ userId, count: userAccounts.length }, 'Triggering async manual sync for user accounts...');

  for (const acc of userAccounts) {
    try {
      const jobId = `account-sync-${acc.id}`;
      const existingJob = await accountSyncQueue.getJob(jobId).catch(() => null);
      if (existingJob) {
        const state = await existingJob.getState().catch(() => null);
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          continue;
        }
      }

      await accountSyncQueue.add('sync-account', { accountId: acc.id }, { jobId });
    } catch (queueErr: any) {
      logger.info(
        { accountId: acc.id, err: queueErr?.message },
        '⚙️ Redis queue unavailable or exceeded, executing manual sync directly in-process...',
      );
      syncGoogleAccountData(acc.id).catch((syncErr) => {
        logger.warn({ accountId: acc.id, err: syncErr?.message }, 'Direct manual sync failed');
      });
    }
  }

  await auditService
    .logAction(userId, 'sync.manual_triggered', {
      accountsQueued: userAccounts.length,
    })
    .catch(() => {});

  res.status(202).json({ success: true, message: 'Sync queued successfully', accountsQueued: userAccounts.length });
});
