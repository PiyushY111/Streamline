import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { syncGoogleAccountData } from '../services/google/google-sync.service.js';
import { createAiTriageWorker } from './ai-triage.worker.js';
import { createDailyDigestWorker, startDailyDigestScheduler, stopDailyDigestScheduler } from './daily-digest.worker.js';
import {
  createRetentionPurgeWorker,
  startRetentionPurgeScheduler,
  stopRetentionPurgeScheduler,
} from './retention-purge.worker.js';
import { stopSyncScheduler } from './scheduler.js';
import { logger } from '../utils/logger.js';
import { runWithContext } from '../utils/context.js';

let accountSyncWorkerInstance: Worker | null = null;
let aiTriageWorkerInstance: Worker | null = null;
let dailyDigestWorkerInstance: Worker | null = null;
let retentionPurgeWorkerInstance: Worker | null = null;

export function startWorkers() {
  logger.info('🚀 Starting BullMQ account sync background worker...');

  accountSyncWorkerInstance = new Worker(
    'account-sync-queue',
    async (job: Job) => {
      return runWithContext(
        {
          requestId: (job.data?.requestId as string) || `job-sync-${job.id}`,
          source: 'account_sync_worker',
        },
        async () => {
          const { accountId } = job.data;
          logger.info({ jobId: job.id, accountId }, '⚙️ Background Worker processing Account Sync job...');
          await syncGoogleAccountData(accountId);
        },
      );
    },
    { connection: redisConnection, concurrency: 2 },
  );

  accountSyncWorkerInstance.on('completed', (job) => {
    logger.info({ jobId: job.id }, '✅ Account Sync Worker job completed');
  });

  accountSyncWorkerInstance.on('error', (err) => {
    if (err?.message?.includes('max requests limit exceeded')) {
      return; // Suppress Upstash quota error spam on worker polling
    }
    logger.warn({ err: err?.message }, 'Account Sync Worker connection error');
  });

  accountSyncWorkerInstance.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Account Sync Worker job failed');
    const { routeToDeadLetterQueue } = await import('../queues/dlq.queue.js');
    await routeToDeadLetterQueue('account-sync-queue', job, err);
  });

  // Start AI Triage, Daily Digest, and Database Retention Purge Workers
  aiTriageWorkerInstance = createAiTriageWorker();
  dailyDigestWorkerInstance = createDailyDigestWorker();
  retentionPurgeWorkerInstance = createRetentionPurgeWorker();
  startDailyDigestScheduler();
  startRetentionPurgeScheduler();

  logger.info('✨ All BullMQ background workers and AI schedulers initialized and active!');
}

export async function stopWorkers(): Promise<void> {
  logger.info('🛑 Stopping all background workers and cron schedulers...');
  stopSyncScheduler();
  stopDailyDigestScheduler();
  stopRetentionPurgeScheduler();

  const closePromises: Promise<any>[] = [];
  if (accountSyncWorkerInstance) {
    closePromises.push(accountSyncWorkerInstance.close());
  }
  if (aiTriageWorkerInstance) {
    closePromises.push(aiTriageWorkerInstance.close());
  }
  if (dailyDigestWorkerInstance) {
    closePromises.push(dailyDigestWorkerInstance.close());
  }
  if (retentionPurgeWorkerInstance) {
    closePromises.push(retentionPurgeWorkerInstance.close());
  }

  await Promise.allSettled(closePromises);
  accountSyncWorkerInstance = null;
  aiTriageWorkerInstance = null;
  dailyDigestWorkerInstance = null;
  retentionPurgeWorkerInstance = null;

  logger.info('✅ All BullMQ background workers and schedulers successfully stopped.');
}
