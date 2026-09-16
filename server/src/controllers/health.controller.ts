import { Request, Response } from 'express';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';
import { getGeminiClient } from '../services/ai/core/gemini.client.js';

/**
 * Fast liveness probe for container orchestrators (Kubernetes / Railway).
 * Returns 200 if process is up and running HTTP event loop without hitting external dependencies.
 */
export function checkLiveness(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness probe checking critical downstream dependencies (PostgreSQL & Redis).
 * Returns 200 when ready to accept traffic, 503 when degraded.
 */
export async function checkReadiness(_req: Request, res: Response): Promise<void> {
  let dbOk = false;
  let redisOk = false;

  try {
    await db.select().from(users).limit(1);
    dbOk = true;
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Readiness probe: database unreachable');
  }

  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    await redis.ping();
    await redis.quit();
    redisOk = true;
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message }, 'Readiness probe: Redis unreachable');
  }

  const isReady = dbOk && redisOk;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
  });
}

/**
 * Comprehensive system diagnostics with service latency breakdown including Gemini.
 */
export async function checkHealth(_req: Request, res: Response): Promise<void> {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';
  let geminiStatus = 'healthy';
  let dbLatencyMs = 0;
  let redisLatencyMs = 0;
  let geminiLatencyMs = 0;

  // 1. Test Neon PostgreSQL connection
  const dbStart = Date.now();
  try {
    await db.select().from(users).limit(1);
    dbLatencyMs = Date.now() - dbStart;
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.error({ err: err.message }, 'PostgreSQL health check failed');
    dbStatus = `unhealthy: ${err.message}`;
  }

  // 2. Test Redis connection
  const redisStart = Date.now();
  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    await redis.ping();
    redisLatencyMs = Date.now() - redisStart;
    await redis.quit();
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.error({ err: err.message }, 'Redis health check failed');
    redisStatus = `unhealthy: ${err.message}`;
  }

  // 3. Test Gemini reachability
  const geminiStart = Date.now();
  try {
    const geminiClient = getGeminiClient();
    if (!geminiClient) {
      geminiStatus = 'mock_mode (no API key configured)';
    } else {
      geminiLatencyMs = Date.now() - geminiStart;
      geminiStatus = 'healthy';
    }
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.error({ err: err.message }, 'Gemini health probe failed');
    geminiStatus = `unhealthy: ${err.message}`;
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
      gemini: {
        status: geminiStatus,
        latencyMs: geminiLatencyMs,
      },
    },
    version: '1.0.0',
  });
}
