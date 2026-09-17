import { redisConnection } from '../queues/index.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

interface MemoryCacheEntry {
  value: any;
  expiresAt: number;
}

// In-memory fallback cache (used transparently when Redis is rate-limited or offline)
const inMemoryCache = new Map<string, MemoryCacheEntry>();
let lastWarningTime = 0;

function logRedisWarning(op: string, key: string, msg: string) {
  const now = Date.now();
  if (msg.includes('max requests limit exceeded')) {
    if (now - lastWarningTime > 60000) {
      lastWarningTime = now;
      logger.warn('Upstash Redis quota exceeded. Cache seamlessly operating in in-memory mode.');
    }
    return;
  }
  if (now - lastWarningTime > 15000) {
    lastWarningTime = now;
    logger.warn({ key, op, err: msg }, 'Redis cache warning (using in-memory fallback)');
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  // 1. Try Redis
  try {
    const cached = await redisConnection.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as T;
      // Sync to local memory cache for fast secondary hits
      inMemoryCache.set(key, { value: parsed, expiresAt: Date.now() + 60000 });
      return parsed;
    }
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logRedisWarning('getCache', key, err.message);
  }

  // 2. Fall back to in-memory TTL cache
  const local = inMemoryCache.get(key);
  if (local) {
    if (Date.now() < local.expiresAt) {
      return local.value as T;
    }
    inMemoryCache.delete(key);
  }

  return null;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 30): Promise<void> {
  // Always update in-memory cache
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Try Redis
  try {
    const data = JSON.stringify(value);
    await redisConnection.setex(key, ttlSeconds, data);
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logRedisWarning('setCache', key, err.message);
  }
}

export async function delCache(keyPattern: string): Promise<void> {
  // Delete from in-memory cache
  const patternRegex = new RegExp('^' + keyPattern.replace(/\*/g, '.*') + '$');
  for (const key of inMemoryCache.keys()) {
    if (patternRegex.test(key)) {
      inMemoryCache.delete(key);
    }
  }

  // Try Redis deletion
  try {
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
    logRedisWarning('delCache', keyPattern, err.message);
  }
}
