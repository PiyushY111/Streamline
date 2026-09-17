import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { db } from '../db/index.js';
import { emails, connectedAccounts } from '../db/schema/index.js';
import { eq, inArray } from 'drizzle-orm';
import { triageEmail } from '../services/ai/features/triage.service.js';
import { aiRepository } from '../repositories/ai.repository.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';
import { runWithContext } from '../utils/context.js';

export function createAiTriageWorker() {
  logger.info('🚀 Initializing BullMQ AI Triage Background Worker...');

  const worker = new Worker(
    'ai-email-triage-queue',
    async (job: Job) => {
      return runWithContext(
        {
          requestId: (job.data?.requestId as string) || `job-triage-${job.id}`,
          source: 'ai_triage_worker',
        },
        async () => {
          const { emailIds, accountId } = job.data as { emailIds?: string[]; emailId?: string; accountId?: string };
          const idsToProcess = emailIds || (job.data.emailId ? [job.data.emailId] : []);

          if (idsToProcess.length === 0) return;

          logger.info({ count: idsToProcess.length }, '🧠 AI Triage Worker processing incoming emails batch...');

          // 1. Fetch emails
          const emailRecords = await db
            .select({
              id: emails.id,
              threadId: emails.threadId,
              accountId: emails.accountId,
              subject: emails.subject,
              sender: emails.sender,
              recipients: emails.recipients,
              bodyText: emails.bodyText,
              receivedAt: emails.receivedAt,
              userId: connectedAccounts.userId,
              userEmail: connectedAccounts.email,
            })
            .from(emails)
            .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
            .where(inArray(emails.id, idsToProcess));

          for (const email of emailRecords) {
            try {
              // Check if already triaged
              const existing = await aiRepository.getEmailAiMetadata(email.id);
              if (existing) continue;

              // Fetch user preferences for VIP senders
              const prefs = await aiRepository.getUserPreferences(email.userId);
              if (prefs && !prefs.isAutoTriageEnabled) {
                continue;
              }

              const triage = await triageEmail(
                {
                  id: email.id,
                  subject: email.subject,
                  sender: email.sender,
                  recipients: email.recipients,
                  bodyText: email.bodyText,
                  receivedAt: email.receivedAt,
                },
                {
                  userId: email.userId,
                  vipSenders: prefs?.vipSenders || [],
                  userEmail: email.userEmail,
                },
              );

              await aiRepository.saveEmailAiMetadata({
                emailId: email.id,
                threadId: email.threadId,
                priority: triage.priority,
                urgencyScore: triage.urgencyScore,
                category: triage.category,
                oneSentenceSummary: triage.oneSentenceSummary,
                newsletterTopic: triage.newsletterTopic,
                extractedTasks: triage.extractedTasks,
                sentiment: triage.sentiment,
              });

              logger.info(
                { emailId: email.id, priority: triage.priority, tasksCount: triage.extractedTasks.length },
                '✅ Email triaged & metadata stored',
              );
            } catch (rawErr: unknown) {
              const err = toError(rawErr);
              logger.error({ err: err.message, emailId: email.id }, 'Error triaging email in worker');
            }
          }
        },
      );
    },
    { connection: redisConnection, concurrency: 3 },
  );

  worker.on('error', (err) => {
    if (err?.message?.includes('max requests limit exceeded')) {
      return;
    }
    logger.warn({ err: err?.message }, 'AI Triage Worker connection error');
  });

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, '❌ AI Triage Worker job failed');
    const { routeToDeadLetterQueue } = await import('../queues/dlq.queue.js');
    await routeToDeadLetterQueue('ai-email-triage-queue', job, err);
  });

  return worker;
}
