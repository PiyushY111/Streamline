import { Worker, Job } from 'bullmq';
import { redisConnection, dailyDigestQueue } from '../queues/index.js';
import { db } from '../db/index.js';
import { users, userAiPreferences, dailyDigests } from '../db/schema/index.js';
import { eq, and, gte } from 'drizzle-orm';
import { generateDailyDigestForUser } from '../services/ai/newsletter-digest.service.js';
import { logger } from '../utils/logger.js';

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
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ Daily Digest Worker job failed');
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
  dailyDigestIntervalHandle = setInterval(async () => {
    try {
      const allUsers = await db.select().from(users);

      for (const user of allUsers) {
        let [prefs] = await db
          .select()
          .from(userAiPreferences)
          .where(eq(userAiPreferences.userId, user.id))
          .limit(1);

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

        const [prefHour, prefMin] = digestTimeStr.split(':').map(Number);
        const [currentHour, currentMin] = userTimeStr.split(':').map(Number);

        // Check if current time matches scheduled window (within 5 minutes)
        const isTimeMatch =
          currentHour === prefHour && currentMin >= prefMin && currentMin < prefMin + 5;

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
            await dailyDigestQueue.add(
              'generate-digest',
              { userId: user.id },
              { jobId }
            );
            logger.info({ userId: user.id, userTimeStr }, 'Enqueued scheduled Daily Digest job');
          }
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error in Daily Digest Cron Scheduler');
    }
  }, 5 * 60 * 1000);
}

export function stopDailyDigestScheduler(): void {
  if (dailyDigestIntervalHandle) {
    clearInterval(dailyDigestIntervalHandle);
    dailyDigestIntervalHandle = null;
    logger.info('🛑 Daily Digest Cron Scheduler stopped.');
  }
}

