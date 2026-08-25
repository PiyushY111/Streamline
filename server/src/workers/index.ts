import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { syncGoogleAccountData } from '../services/google/google-sync.service.js';
import { logger } from '../utils/logger.js';

export function startWorkers() {
  logger.info('🚀 Starting BullMQ multi-queue background workers for Gmail & Calendar...');

  const gmailWorker = new Worker(
    'gmail-sync-queue',
    async (job: Job) => {
      const { accountId } = job.data;
      logger.info({ jobId: job.id, accountId }, '⚙️ Background Worker processing Gmail Sync job...');
      await syncGoogleAccountData(accountId);
    },
    { connection: redisConnection, concurrency: 3 }
  );

  gmailWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '✅ Gmail Sync Worker job completed');
  });

  gmailWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Gmail Sync Worker job failed');
  });

  const calendarWorker = new Worker(
    'calendar-sync-queue',
    async (job: Job) => {
      const { accountId } = job.data;
      logger.info({ jobId: job.id, accountId }, '⚙️ Background Worker processing Calendar Sync job...');
      await syncGoogleAccountData(accountId);
    },
    { connection: redisConnection, concurrency: 3 }
  );

  calendarWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '✅ Calendar Sync Worker job completed');
  });

  calendarWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Calendar Sync Worker job failed');
  });

  logger.info('✨ All BullMQ background workers initialized and active!');
}
