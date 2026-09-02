import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export { redisConnection } from './connection.js';

export const accountSyncQueue = new Queue('account-sync-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 200 },
  },
});

export * from './ai.queue.js';
