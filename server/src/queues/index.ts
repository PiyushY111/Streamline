import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: { rejectUnauthorized: false },
});

export const accountSyncQueue = new Queue('account-sync-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 200 },
  },
});
