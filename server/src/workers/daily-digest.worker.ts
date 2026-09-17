import { Worker, Job } from 'bullmq';
import { redisConnection, dailyDigestQueue } from '../queues/index.js';
import { db } from '../db/index.js';
import { users, userAiPreferences, dailyDigests } from '../db/schema/index.js';
import { eq, and, gte } from 'drizzle-orm';
import { generateDailyDigestForUser } from '../services/ai/features/newsletter-digest.service.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export function createDailyDigestWorker() {
  logger.info('🚀 Initializing BullMQ Daily Digest Worker...');

  const worker = new Worker(
    'daily-digest-cron-queue',
    async (job: Job) => {
      const { userId } = job.data as { userId: string };
      if (!userId) return;

      logger.info({ userId }, '📰 Running Daily Digest generator job...');
      await generateDailyDigestForUser(userId);
    },
    { connection: redisConnection, concurrency: 2 },
  );

  worker.on('error', (err) => {
    if (err?.message?.includes('max requests limit exceeded')) {
      return;
    }
    logger.warn({ err: err?.message }, 'Daily Digest Worker connection error');
  });

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Daily Digest Worker job failed');
    const { routeToDeadLetterQueue } = await import('../queues/dlq.queue.js');
    await routeToDeadLetterQueue('daily-digest-cron-queue', job, err);
  });

  return worker;
}

let dailyDigestIntervalHandle: NodeJS.Timeout | null = null;

export function startDailyDigestScheduler() {
  logger.info('⏰ Initializing 5-Minute Daily Digest Cron Scheduler...');

  if (dailyDigestIntervalHandle) {
    clearInterval(dailyDigestIntervalHandle);
  }

  // Check every 5 minutes if any user is due for their Daily Digest
  dailyDigestIntervalHandle = setInterval(
    async () => {
      try {
        const allUsers = await db.select().from(users);

        for (const user of allUsers) {
          let [prefs] = await db.select().from(userAiPreferences).where(eq(userAiPreferences.userId, user.id)).limit(1);

          const digestTimeStr = prefs?.digestTime || '08:00:00'; // e.g. "08:00:00"
          const timezone = prefs?.digestTimezone || 'UTC';

          // Check current time in user's timezone
          const now = new Date();
          const userDateStr = now.toLocaleDateString('en-US', { timeZone: timezone });
          const userTimeStr = now.toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          });

          const prefParts = digestTimeStr.split(':').map(Number);
          const currentParts = userTimeStr.split(':').map(Number);
          const prefHour = prefParts[0] ?? 8;
          const prefMin = prefParts[1] ?? 0;
          const currentHour = currentParts[0] ?? 0;
          const currentMin = currentParts[1] ?? 0;

          // Check if current time matches scheduled window (within 5 minutes)
          const isTimeMatch = currentHour === prefHour && currentMin >= prefMin && currentMin < prefMin + 5;

          if (isTimeMatch) {
            // Check if digest was already generated today for this user
            const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
            const [existingToday] = await db
              .select()
              .from(dailyDigests)
              .where(and(eq(dailyDigests.userId, user.id), gte(dailyDigests.digestDate, startOfToday)))
              .limit(1);

            if (!existingToday) {
              const jobId = `digest-${user.id}-${new Date().toISOString().split('T')[0]}`;
              try {
                await dailyDigestQueue.add('generate-digest', { userId: user.id }, { jobId });
                logger.info({ userId: user.id, userTimeStr }, 'Enqueued scheduled Daily Digest job');
              } catch (queueErr: unknown) {
                const qErr = toError(queueErr);
                if (qErr.message.includes('max requests limit exceeded')) {
                  // Fallback directly to in-process generator
                  generateDailyDigestForUser(user.id).catch((genErr) => {
                    logger.warn({ userId: user.id, err: genErr?.message }, 'Direct daily digest generation warning');
                  });
                } else {
                  logger.warn({ userId: user.id, err: qErr.message }, 'Failed to enqueue daily digest job');
                }
              }
            }
          }
        }
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        if (!err.message.includes('max requests limit exceeded')) {
          logger.error({ err: err.message }, 'Error in Daily Digest Cron Scheduler');
        }
      }
    },
    5 * 60 * 1000,
  );
}

export function stopDailyDigestScheduler(): void {
  if (dailyDigestIntervalHandle) {
    clearInterval(dailyDigestIntervalHandle);
    dailyDigestIntervalHandle = null;
    logger.info('🛑 Daily Digest Cron Scheduler stopped.');
  }
}
