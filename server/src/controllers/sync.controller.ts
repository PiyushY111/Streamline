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

export const triggerManualSync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
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

  await auditService.logAction(userId, 'sync.manual_triggered', {
    accountsQueued: userAccounts.length,
  });

  res.status(202).json({ success: true, message: 'Sync queued successfully', accountsQueued: userAccounts.length });
});
