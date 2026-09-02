import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { syncGoogleAccountData } from '../services/google/google-sync.service.js';
import { createAiTriageWorker } from './ai-triage.worker.js';
import { createDailyDigestWorker, startDailyDigestScheduler } from './daily-digest.worker.js';
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

  // Start AI Triage and Daily Digest Workers
  createAiTriageWorker();
  createDailyDigestWorker();
  startDailyDigestScheduler();

  logger.info('✨ All BullMQ background workers and AI schedulers initialized and active!');
}

