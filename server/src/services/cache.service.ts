import { redisConnection } from '../queues/index.js';
import { logger } from '../utils/logger.js';

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisConnection.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err: any) {
    logger.warn({ key, err: err?.message || 'Cache read failed' }, 'Redis getCache warning');
  }
  return null;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 30): Promise<void> {
  try {
    const data = JSON.stringify(value);
    await redisConnection.setex(key, ttlSeconds, data);
  } catch (err: any) {
    logger.warn({ key, err: err?.message || 'Cache write failed' }, 'Redis setCache warning');
  }
}

export async function delCache(keyPattern: string): Promise<void> {
  try {
    const keys = await redisConnection.keys(keyPattern);
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  } catch (err: any) {
    logger.warn({ keyPattern, err: err?.message || 'Cache delete failed' }, 'Redis delCache warning');
  }
}
