import { deadLetterQueue, accountSyncQueue, aiTriageQueue, dailyDigestQueue } from '../src/queues/index.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isReplay = process.argv.includes('--replay');

  logger.info('🔍 Inspecting Streamline BullMQ Dead-Letter Queue (DLQ)...');

  const jobs = await deadLetterQueue.getJobs(['waiting', 'delayed', 'failed', 'completed']);
  console.log(`\nFound ${jobs.length} job(s) in Dead-Letter Queue.\n`);

  if (jobs.length === 0) {
    console.log('✅ DLQ is clean. No exhausted jobs found.');
    process.exit(0);
  }

  for (const job of jobs) {
    const payload = job.data;
    console.log('----------------------------------------------------');
    console.log(`DLQ Job ID:       ${job.id}`);
    console.log(`Original Queue:   ${payload.originalQueue}`);
    console.log(`Original Job ID:  ${payload.jobId}`);
    console.log(`Original Job:     ${payload.jobName}`);
    console.log(`Failed Reason:    ${payload.failedReason}`);
    console.log(`Failed At:        ${payload.failedAt}`);
    console.log(`Attempts Made:    ${payload.attemptsMade}`);
    console.log('Payload Data:', JSON.stringify(payload.data, null, 2));

    if (isReplay && !isDryRun) {
      console.log(`🔄 Replaying job to ${payload.originalQueue}...`);
      let targetQueue;
      if (payload.originalQueue === 'account-sync-queue') {
        targetQueue = accountSyncQueue;
      } else if (payload.originalQueue === 'ai-email-triage-queue') {
        targetQueue = aiTriageQueue;
      } else if (payload.originalQueue === 'daily-digest-cron-queue') {
        targetQueue = dailyDigestQueue;
      }

      if (targetQueue) {
        await targetQueue.add(payload.jobName, payload.data);
        await job.remove();
        console.log(`✅ Successfully replayed and removed from DLQ.`);
      } else {
        console.warn(`⚠️ Unknown original queue "${payload.originalQueue}". Skipping.`);
      }
    }
  }

  if (isDryRun) {
    console.log('\n[Dry Run] No jobs were replayed or modified.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('DLQ Management Script Error:', err);
  process.exit(1);
});
