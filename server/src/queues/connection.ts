import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const isTls = env.REDIS_URL.startsWith('rediss://');

export let isRedisQuotaExceeded = false;
let lastLogTime = 0;

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  reconnectOnError: (err) => {
    const msg = err.message || '';
    if (msg.includes('max requests limit exceeded')) {
      isRedisQuotaExceeded = true;
      return false; // Do not endlessly thrash reconnects if quota is exceeded
    }
    return true;
  },
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
});

redisConnection.on('error', (err: any) => {
  const msg = err?.message || 'Redis connection error';
  const now = Date.now();

  if (msg.includes('max requests limit exceeded')) {
    isRedisQuotaExceeded = true;
    // Throttle warning log to once every 60 seconds
    if (now - lastLogTime > 60000) {
      lastLogTime = now;
      logger.warn(
        '⚠️ Upstash Redis daily request quota exceeded (500k limit). In-memory fallback cache & local processing active.',
      );
    }
    return;
  }

  if (now - lastLogTime > 15000) {
    lastLogTime = now;
    logger.warn({ err: msg }, 'Redis connection warning');
  }
});
