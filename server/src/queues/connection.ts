import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const isTls = env.REDIS_URL.startsWith('rediss://');

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
});

redisConnection.on('error', (err: any) => {
  logger.warn({ err: err?.message || 'Redis connection error' }, 'Redis connection warning');
});
