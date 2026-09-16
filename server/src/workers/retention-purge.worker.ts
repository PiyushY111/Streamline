import { Worker, Job, Queue } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { db } from '../db/index.js';
import { pendingActions, agentSessions, auditLogs, aiTokenUsage } from '../db/schema/index.js';
import { and, inArray, lt, sql, notInArray, eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export const RETENTION_PURGE_QUEUE_NAME = 'retention-purge-queue';

export const retentionPurgeQueue = new Queue(RETENTION_PURGE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 50 },
    removeOnFail: { age: 604800, count: 100 },
  },
});

export interface RetentionPurgeOptions {
  pendingActionRetentionDays?: number;
  idleSessionRetentionDays?: number;
  auditLogRetentionDays?: number;
  tokenUsageRetentionDays?: number;
}

export interface RetentionPurgeResult {
  purgedPendingActions: number;
  purgedIdleSessions: number;
  purgedAuditLogs: number;
  purgedTokenUsage: number;
  durationMs: number;
}

/**
 * Core database cleanup job executing automated retention TTL policies
 */
export async function executeRetentionPurge(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeResult> {
  const startTime = Date.now();
  const pendingDays = options.pendingActionRetentionDays ?? 30;
  const sessionDays = options.idleSessionRetentionDays ?? 90;
  const auditDays = options.auditLogRetentionDays ?? 365;
  const tokenDays = options.tokenUsageRetentionDays ?? 180;

  const pendingCutoff = new Date(Date.now() - pendingDays * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(Date.now() - sessionDays * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(Date.now() - auditDays * 24 * 60 * 60 * 1000);
  const tokenCutoff = new Date(Date.now() - tokenDays * 24 * 60 * 60 * 1000);

  logger.info(
    { pendingCutoff, sessionCutoff, auditCutoff, tokenCutoff },
    '🧹 Executing automated database retention & TTL purge'
  );

  let purgedPendingActions = 0;
  let purgedIdleSessions = 0;
  let purgedAuditLogs = 0;
  let purgedTokenUsage = 0;

  // 1. Purge expired/resolved pending actions older than 30 days
  try {
    const deletedActions = await db
      .delete(pendingActions)
      .where(
        and(
          inArray(pendingActions.status, ['expired', 'rejected', 'executed', 'failed']),
          lt(pendingActions.createdAt, pendingCutoff)
        )
      )
      .returning({ id: pendingActions.id });

    purgedPendingActions = deletedActions.length;
    logger.info({ count: purgedPendingActions }, 'Purged expired/resolved pending actions');
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Failed to purge pending actions during retention run');
  }

  // 2. Purge idle/stale agent sessions older than 90 days
  try {
    const deletedSessions = await db
      .delete(agentSessions)
      .where(lt(agentSessions.updatedAt, sessionCutoff))
      .returning({ id: agentSessions.id });

    purgedIdleSessions = deletedSessions.length;
    logger.info({ count: purgedIdleSessions }, 'Purged stale agent sessions');
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Failed to purge idle agent sessions');
  }

  // 3. Purge compliance audit logs older than retention window (365 days)
  try {
    const deletedLogs = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditCutoff))
      .returning({ id: auditLogs.id });

    purgedAuditLogs = deletedLogs.length;
    logger.info({ count: purgedAuditLogs }, 'Purged aged audit logs past retention SLA');
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Failed to purge audit logs');
  }

  // 4. Purge AI token usage history older than 180 days
  try {
    const deletedUsage = await db
      .delete(aiTokenUsage)
      .where(lt(aiTokenUsage.createdAt, tokenCutoff))
      .returning({ id: aiTokenUsage.id });

    purgedTokenUsage = deletedUsage.length;
    logger.info({ count: purgedTokenUsage }, 'Purged aged AI token usage records');
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Failed to purge AI token usage records');
  }

  const durationMs = Date.now() - startTime;
  logger.info(
    { purgedPendingActions, purgedIdleSessions, purgedAuditLogs, purgedTokenUsage, durationMs },
    '✅ Database retention purge cycle finished'
  );

  return {
    purgedPendingActions,
    purgedIdleSessions,
    purgedAuditLogs,
    purgedTokenUsage,
    durationMs,
  };
}

let purgeWorkerInstance: Worker | null = null;
let purgeSchedulerHandle: NodeJS.Timeout | null = null;

export function createRetentionPurgeWorker(): Worker {
  if (purgeWorkerInstance) {
    return purgeWorkerInstance;
  }

  logger.info('🚀 Initializing BullMQ Database Retention Purge Worker...');

  purgeWorkerInstance = new Worker(
    RETENTION_PURGE_QUEUE_NAME,
    async (job: Job) => {
      logger.info({ jobId: job.id }, '⚙️ Retention Purge Worker processing maintenance job...');
      const result = await executeRetentionPurge(job.data || {});
      return result;
    },
    { connection: redisConnection, concurrency: 1 }
  );

  purgeWorkerInstance.on('completed', (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, '✅ Retention Purge Worker job completed');
  });

  purgeWorkerInstance.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Retention Purge Worker job failed');
    const { routeToDeadLetterQueue } = await import('../queues/dlq.queue.js');
    await routeToDeadLetterQueue(RETENTION_PURGE_QUEUE_NAME, job, err);
  });

  return purgeWorkerInstance;
}

export function startRetentionPurgeScheduler(intervalMs = 24 * 60 * 60 * 1000): void {
  logger.info('⏰ Initializing Daily Database Retention Purge Cron Scheduler...');

  if (purgeSchedulerHandle) {
    clearInterval(purgeSchedulerHandle);
  }

  purgeSchedulerHandle = setInterval(async () => {
    try {
      const jobId = `retention-purge-${new Date().toISOString().slice(0, 10)}`;
      const existingJob = await retentionPurgeQueue.getJob(jobId);
      if (!existingJob) {
        await retentionPurgeQueue.add('execute-purge', {}, { jobId });
        logger.info({ jobId }, '⏰ Scheduled retention purge job enqueued');
      }
    } catch (rawErr: unknown) {
      const err = toError(rawErr);
      logger.error({ err: err.message }, 'Error in Retention Purge Scheduler');
    }
  }, intervalMs);
}

export function stopRetentionPurgeScheduler(): void {
  if (purgeSchedulerHandle) {
    clearInterval(purgeSchedulerHandle);
    purgeSchedulerHandle = null;
    logger.info('🛑 Retention Purge Scheduler stopped.');
  }
}
