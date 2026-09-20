import { randomUUID } from 'node:crypto';
import { redisConnection } from '../queues/connection.js';
import { logger } from './logger.js';
import { toError } from './errors.js';

/**
 * Redis-backed distributed mutex. Guards operations that must run at most once at a time
 * across multiple server replicas (e.g. OAuth token refresh for a given account), where a
 * plain in-process Map/mutex only protects within a single process.
 *
 * Uses SET key val NX PX ttl for atomic acquisition and a compare-and-delete Lua script for
 * release, so a process only ever releases a lock it still owns (never someone else's lock
 * acquired after its own TTL expired).
 *
 * Fails open: if Redis itself is unavailable (connection error, Upstash quota exhaustion), lock
 * acquisition is reported as "degraded" rather than throwing, so callers can fall back to
 * best-effort in-process-only behavior instead of that Redis outage taking down account sync.
 */

const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface LockAcquireAttempt {
  acquired: boolean;
  /** True when acquisition failed because Redis itself errored, not due to lock contention. */
  degraded: boolean;
}

async function tryAcquire(key: string, token: string, ttlMs: number): Promise<LockAcquireAttempt> {
  try {
    const res = await redisConnection.set(key, token, 'PX', ttlMs, 'NX');
    return { acquired: res === 'OK', degraded: false };
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ key, err: err.message }, 'Distributed lock acquisition failed (Redis unavailable) — degrading to in-process-only locking for this call');
    return { acquired: false, degraded: true };
  }
}

async function release(key: string, token: string): Promise<void> {
  try {
    await redisConnection.eval(UNLOCK_SCRIPT, 1, key, token);
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ key, err: err.message }, 'Distributed lock release failed (non-fatal — lock will expire via TTL)');
  }
}

export interface WithDistributedLockResult<T> {
  result: T;
  /** True if a real Redis lock was held while `fn` ran. */
  lockAcquired: boolean;
  /** True if Redis was unavailable and `fn` ran without any cross-replica protection. */
  degraded: boolean;
  /** True if another holder had the lock and we gave up waiting and ran `fn` anyway. */
  timedOutWaiting: boolean;
}

/**
 * Runs `fn` while holding a distributed lock on `key`. If another process holds it, polls until
 * released or `maxWaitMs` elapses. On timeout or Redis unavailability, still runs `fn` (callers
 * doing a refresh-style operation should re-check whether the work is still needed once inside
 * `fn`, since another holder may have already done it) rather than deadlocking.
 */
export async function withDistributedLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<WithDistributedLockResult<T>> {
  const maxWaitMs = opts.maxWaitMs ?? 12000;
  const pollIntervalMs = opts.pollIntervalMs ?? 250;
  const deadline = Date.now() + maxWaitMs;
  const token = randomUUID();

  let acquired = false;
  let degraded = false;

  while (Date.now() < deadline) {
    const attempt = await tryAcquire(key, token, ttlMs);
    if (attempt.acquired) {
      acquired = true;
      break;
    }
    if (attempt.degraded) {
      degraded = true;
      break;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const timedOutWaiting = !acquired && !degraded;
  if (timedOutWaiting) {
    logger.warn({ key, maxWaitMs }, 'Distributed lock wait timed out; proceeding without lock (best-effort)');
  }

  try {
    const result = await fn();
    return { result, lockAcquired: acquired, degraded, timedOutWaiting };
  } finally {
    if (acquired) {
      await release(key, token);
    }
  }
}
