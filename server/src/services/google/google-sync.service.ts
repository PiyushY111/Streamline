import { db } from '../../db/index.js';
import { connectedAccounts } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { createOAuth2Client } from '../../utils/google-oauth.js';
import { decrypt } from '../../utils/encryption.js';
import { logger } from '../../utils/logger.js';
import { syncGmailMessages } from './gmail-sync.service.js';
import { syncGoogleCalendar } from './calendar-sync.service.js';
import { syncGoogleContacts } from './contacts-sync.service.js';

export async function syncGoogleAccountData(accountId: string): Promise<void> {
  const startTime = Date.now();
  logger.info({ accountId }, 'Starting Google synchronization pipeline...');

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error(`Connected account not found for ID: ${accountId}`);
  }

  const accessToken = decrypt(account.accessToken);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const [emailCount, eventCount, contactCount] = await Promise.all([
    syncGmailMessages(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Gmail sync error'); return 0; }),
    syncGoogleCalendar(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Calendar sync error'); return 0; }),
    syncGoogleContacts(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Contacts sync error'); return 0; }),
  ]);

  const durationMs = Date.now() - startTime;
  logger.info({ accountId, emailCount, eventCount, contactCount, durationMs }, 'Sync pipeline completed');
}
