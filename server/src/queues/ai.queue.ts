import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const aiTriageQueue = new Queue('ai-email-triage-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 200 },
    removeOnFail: { age: 86400, count: 500 },
  },
});

export const dailyDigestQueue = new Queue('daily-digest-cron-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 7200, count: 100 },
    removeOnFail: { age: 86400, count: 200 },
  },
});
