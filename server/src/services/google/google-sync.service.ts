import { logger } from '../../utils/logger.js';
import { syncGmailMessages, getGmailClientForAccount } from './gmail-sync.service.js';
import { syncGoogleCalendar } from './calendar-sync.service.js';
import { syncGoogleContacts } from './contacts-sync.service.js';

export async function syncGoogleAccountData(accountId: string): Promise<void> {
  const startTime = Date.now();
  logger.info({ accountId }, 'Starting Google synchronization pipeline...');

  const clientData = await getGmailClientForAccount(accountId);
  if (!clientData) {
    throw new Error(`Connected account not found for ID: ${accountId}`);
  }

  const { oauth2Client } = clientData;

  const [emailCount, eventCount, contactCount] = await Promise.all([
    syncGmailMessages(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Gmail sync error'); return 0; }),
    syncGoogleCalendar(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Calendar sync error'); return 0; }),
    syncGoogleContacts(oauth2Client, accountId).catch(err => { logger.error({ err }, 'Contacts sync error'); return 0; }),
  ]);

  const durationMs = Date.now() - startTime;
  logger.info({ accountId, emailCount, eventCount, contactCount, durationMs }, 'Sync pipeline completed');
}
