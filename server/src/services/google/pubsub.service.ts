import { google } from 'googleapis';
import { logger } from '../../utils/logger.js';
import { googleTokenManager } from './token-manager.service.js';
import { db } from '../../db/index.js';
import { connectedAccounts } from '../../db/schema/accounts.js';
import { eq, and } from 'drizzle-orm';
import { syncGoogleAccountData } from './google-sync.service.js';
import { delCache } from '../cache.service.js';
import { sseService } from '../sse.service.js';

export interface GmailWatchResult {
  historyId?: string;
  expiration?: string;
}

export interface PubSubPushPayload {
  emailAddress: string;
  historyId: string;
}

export class GooglePubSubService {
  /**
   * Register a Gmail watch subscription with Google Cloud Pub/Sub
   */
  public async setupGmailWatch(accountId: string, topicName?: string): Promise<GmailWatchResult> {
    const effectiveTopic = topicName || process.env.GOOGLE_PUBSUB_TOPIC;
    if (!effectiveTopic) {
      throw new Error('Google Cloud Pub/Sub topic name is not configured (set GOOGLE_PUBSUB_TOPIC in env).');
    }

    const result = await googleTokenManager.getValidOAuth2Client(accountId);
    if (!result) {
      throw new Error(`Failed to obtain authorized Google client for account ${accountId}`);
    }
    const oauth2Client = result.oauth2Client;
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    logger.info({ accountId, topic: effectiveTopic }, 'Registering Gmail watch subscription with Google Pub/Sub...');

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: effectiveTopic,
        labelIds: ['INBOX'],
      },
    });

    const historyId = res.data.historyId ?? undefined;
    const expiration = res.data.expiration ?? undefined;

    logger.info({ accountId, historyId, expiration }, 'Gmail Pub/Sub watch registration successful');
    return { historyId, expiration };
  }

  /**
   * Stop an active Gmail watch subscription
   */
  public async stopGmailWatch(accountId: string): Promise<void> {
    const result = await googleTokenManager.getValidOAuth2Client(accountId);
    if (!result) {
      throw new Error(`Failed to obtain authorized Google client for account ${accountId}`);
    }
    const oauth2Client = result.oauth2Client;
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    await gmail.users.stop({ userId: 'me' });
    logger.info({ accountId }, 'Gmail watch subscription stopped successfully');
  }

  /**
   * Process incoming Pub/Sub webhook push notification
   */
  public async handlePubSubPush(payload: PubSubPushPayload): Promise<{ synced: boolean; accountId?: string }> {
    const { emailAddress, historyId } = payload;
    logger.info({ emailAddress, historyId }, 'Processing real-time Gmail Pub/Sub push notification');

    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.email, emailAddress), eq(connectedAccounts.status, 'active')))
      .limit(1);

    if (!account) {
      logger.warn({ emailAddress }, 'No active connected account found matching Pub/Sub push email');
      return { synced: false };
    }

    // Execute fast sync (< 1.5s)
    await syncGoogleAccountData(account.id);
    await delCache(`emails:${account.userId}:*`);

    // Emit real-time SSE event directly to connected browser tab
    sseService.emitToUser(account.userId, 'email.received', {
      accountId: account.id,
      emailAddress: account.email,
      historyId,
      timestamp: new Date().toISOString(),
    });

    logger.info({ accountId: account.id, userId: account.userId }, 'Real-time push sync completed and SSE event emitted');
    return { synced: true, accountId: account.id };
  }
}

export const googlePubSubService = new GooglePubSubService();
