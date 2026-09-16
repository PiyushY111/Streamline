import { Queue, Job } from 'bullmq';
import { redisConnection } from './connection.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export interface DeadLetterJobPayload {
  originalQueue: string;
  jobId: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  stacktrace?: string[];
  attemptsMade: number;
  failedAt: string;
}

export const deadLetterQueue = new Queue<DeadLetterJobPayload>('streamline-dead-letter-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Checks if a failed job has exhausted its retry attempts.
 * If so, records the failure reason and payload into the Dead-Letter Queue for inspection and replay.
 */
export async function routeToDeadLetterQueue(
  originalQueueName: string,
  job: Job | undefined,
  rawError: unknown
): Promise<void> {
  if (!job) return;

  const error = toError(rawError);
  const maxAttempts = job.opts?.attempts ?? 1;

  if (job.attemptsMade >= maxAttempts) {
    logger.error(
      {
        jobId: job.id,
        queue: originalQueueName,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        err: error.message,
      },
      '🚨 Job exhausted all retries! Routing payload to Dead-Letter Queue (DLQ)'
    );

    try {
      await deadLetterQueue.add(
        `${originalQueueName}-dead-letter`,
        {
          originalQueue: originalQueueName,
          jobId: String(job.id || 'unknown'),
          jobName: job.name || 'unnamed',
          data: job.data,
          failedReason: error.message,
          stacktrace: job.stacktrace && job.stacktrace.length > 0 ? job.stacktrace : [error.stack || ''],
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        }
      );
    } catch (dlqErr: unknown) {
      logger.error(
        { dlqErr: toError(dlqErr).message, jobId: job.id },
        'Critical failure: could not push job to Dead-Letter Queue'
      );
    }
  }
}
