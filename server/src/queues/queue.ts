export const QUEUE_NAMES = {
  GMAIL_INITIAL_SYNC: 'gmail-initial-sync',
  GMAIL_INCREMENTAL_SYNC: 'gmail-incremental-sync',
  CALENDAR_INITIAL_SYNC: 'calendar-initial-sync',
  CALENDAR_INCREMENTAL_SYNC: 'calendar-incremental-sync',
  SEND_EMAIL: 'send-email',
  CREATE_EVENT: 'create-event',
  DIGEST_GENERATE: 'digest-generate',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
