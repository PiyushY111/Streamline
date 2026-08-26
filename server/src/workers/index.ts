import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { syncGoogleAccountData } from '../services/google/google-sync.service.js';
import { logger } from '../utils/logger.js';

export function startWorkers() {
  logger.info('🚀 Starting BullMQ account sync background worker...');

  const accountSyncWorker = new Worker(
    'account-sync-queue',
    async (job: Job) => {
      const { accountId } = job.data;
      logger.info({ jobId: job.id, accountId }, '⚙️ Background Worker processing Account Sync job...');
      await syncGoogleAccountData(accountId);
    },
    { connection: redisConnection, concurrency: 2 }
  );

  accountSyncWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '✅ Account Sync Worker job completed');
  });

  accountSyncWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Account Sync Worker job failed');
  });

  logger.info('✨ BullMQ background worker initialized and active!');
}
