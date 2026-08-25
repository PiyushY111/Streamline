import { Request, Response } from 'express';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function checkHealth(req: Request, res: Response): Promise<void> {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';
  let dbLatencyMs = 0;
  let redisLatencyMs = 0;

  // Test Neon PostgreSQL connection
  const dbStart = Date.now();
  try {
    await db.select().from(users).limit(1);
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    logger.error({ err }, 'PostgreSQL health check failed');
    dbStatus = `unhealthy: ${err.message || err}`;
  }

  // Test Redis connection
  const redisStart = Date.now();
  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    await redis.ping();
    redisLatencyMs = Date.now() - redisStart;
    await redis.quit();
  } catch (err: any) {
    logger.error({ err }, 'Redis health check failed');
    redisStatus = `unhealthy: ${err.message || err}`;
  }

  const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      postgres: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
      },
    },
    version: '1.0.0',
  });
}
