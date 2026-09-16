import { logger } from '../../utils/logger.js';
import { toError } from '../../utils/errors.js';
import { withRetryAndTimeout } from '../../utils/resilience.js';
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
    withRetryAndTimeout(
      async () => syncGmailMessages(oauth2Client, accountId),
      { timeoutMs: 30000, maxRetries: 1, backoffBaseMs: 1000, operationName: `sync_gmail_${accountId}` }
    ).catch((err: unknown) => {
      logger.error({ err: toError(err).message, accountId }, 'Gmail sync error');
      return 0;
    }),
    withRetryAndTimeout(
      async () => syncGoogleCalendar(oauth2Client, accountId),
      { timeoutMs: 30000, maxRetries: 1, backoffBaseMs: 1000, operationName: `sync_calendar_${accountId}` }
    ).catch((err: unknown) => {
      logger.error({ err: toError(err).message, accountId }, 'Calendar sync error');
      return 0;
    }),
    withRetryAndTimeout(
      async () => syncGoogleContacts(oauth2Client, accountId),
      { timeoutMs: 20000, maxRetries: 1, backoffBaseMs: 1000, operationName: `sync_contacts_${accountId}` }
    ).catch((err: unknown) => {
      logger.error({ err: toError(err).message, accountId }, 'Contacts sync error');
      return 0;
    }),
  ]);

  const durationMs = Date.now() - startTime;
  logger.info({ accountId, emailCount, eventCount, contactCount, durationMs }, 'Sync pipeline completed');
}
