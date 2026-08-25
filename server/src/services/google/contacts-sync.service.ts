import { logger } from '../../utils/logger.js';

export async function syncGoogleContacts(oauth2Client: any, accountId: string): Promise<number> {
  logger.info({ accountId }, 'Google Contacts sync stub execution');
  return 0;
}
