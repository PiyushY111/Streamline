import { Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { connectedAccounts } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { syncGoogleAccountData } from '../services/google-sync.service.js';
import { logger } from '../utils/logger.js';

export async function triggerManualSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const activeAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.status, 'active'));

    logger.info({ count: activeAccounts.length }, 'Triggering manual sync for active accounts...');

    for (const acc of activeAccounts) {
      syncGoogleAccountData(acc.id).catch((err) => {
        logger.error({ err, accountId: acc.id }, 'Manual sync failed for account');
      });
    }

    res.json({ message: 'Live synchronization triggered successfully', accountsSynced: activeAccounts.length });
  } catch (err: any) {
    logger.error({ err }, 'Error triggering manual sync');
    res.status(500).json({ error: 'Failed to trigger synchronization' });
  }
}
