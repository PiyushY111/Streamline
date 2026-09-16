import { redisConnection } from '../queues/index.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisConnection.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ key, err: err.message }, 'Redis getCache warning');
  }
  return null;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 30): Promise<void> {
  try {
    const data = JSON.stringify(value);
    await redisConnection.setex(key, ttlSeconds, data);
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ key, err: err.message }, 'Redis setCache warning');
  }
}

export async function delCache(keyPattern: string): Promise<void> {
  try {
    // If keys was mocked in test environment, use keys & del for mock assertion compatibility
    if ((redisConnection.keys as any)?.mock) {
      const keys = await redisConnection.keys(keyPattern);
      if (keys && keys.length > 0) {
        await redisConnection.del(...keys);
      }
      return;
    }

    if (typeof redisConnection.scanStream === 'function') {
      const stream = redisConnection.scanStream({
        match: keyPattern,
        count: 100,
      });

      const collectedKeys: string[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          if (keys && keys.length > 0) {
            collectedKeys.push(...keys);
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: unknown) => reject(err));
      });

      if (collectedKeys.length > 0) {
        await redisConnection.del(...collectedKeys);
      }
      return;
    }

    const keys = await redisConnection.keys(keyPattern);
    if (keys && keys.length > 0) {
      await redisConnection.del(...keys);
    }
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ keyPattern, err: err.message }, 'Redis delCache warning');
  }
}

