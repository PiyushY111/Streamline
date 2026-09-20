import 'dotenv/config';
import { initAccountSyncScheduler } from '../src/workers/scheduler.js';
import { accountSyncQueue, redisConnection } from '../src/queues/index.js';
import { ACCOUNT_SYNC_TICK_SCHEDULER_ID } from '../src/workers/scheduler.js';

/**
 * Real-Redis proof that N replicas independently calling `initAccountSyncScheduler()` at
 * startup converge to exactly ONE BullMQ Job Scheduler definition, not N competing ones.
 *
 * This is deliberately a standalone script rather than a vitest test: it needs a real,
 * reachable Redis (this repo's shared dev Upstash instance was over its daily request quota
 * when this was written — see scheduler.test.ts — so this is meant to be run once quota resets,
 * or against any other real Redis via REDIS_URL).
 *
 * Usage: tsx scripts/verify-scheduler-no-double-enqueue.ts
 */
async function main() {
  console.log('Simulating 3 replicas calling initAccountSyncScheduler() concurrently at startup...');

  await Promise.all([initAccountSyncScheduler(), initAccountSyncScheduler(), initAccountSyncScheduler()]);

  const schedulers = await accountSyncQueue.getJobSchedulers();
  const matching = schedulers.filter((s) => s.id === ACCOUNT_SYNC_TICK_SCHEDULER_ID);

  console.log(`Found ${matching.length} scheduler(s) with id "${ACCOUNT_SYNC_TICK_SCHEDULER_ID}" (expected: 1).`);
  console.log(JSON.stringify(matching, null, 2));

  if (matching.length !== 1) {
    console.error('❌ FAILED: expected exactly one converged scheduler definition.');
    process.exit(1);
  }

  console.log('✅ PASSED: 3 concurrent "replica" registrations converged to exactly one Redis-backed schedule.');
  await redisConnection.quit();
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
