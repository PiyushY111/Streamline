import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleTokenManager } from '../services/google/token-manager.service.js';
import { db } from '../db/index.js';
import { redisConnection } from '../queues/connection.js';
import * as googleOAuthUtils from '../utils/google-oauth.js';
import * as encryptionUtils from '../utils/encryption.js';

/**
 * Proves the Redis-backed distributed lock in token-manager.service.ts actually protects
 * against TWO SEPARATE SERVER REPLICAS racing on the same account's token refresh — something
 * the pre-existing in-process singleflight mutex (activeOperations Map) cannot do, since each
 * replica is a separate process with its own Map.
 *
 * Two independent `GoogleTokenManager` instances are used to simulate two replicas: each has
 * its own in-process mutex, but both share the same (mocked) Redis lock and the same
 * (mocked, but stateful) Postgres row — exactly the resources real replicas would share.
 *
 * The Redis mock is a small in-memory store that faithfully implements the actual primitives
 * used (`SET key val PX ttl NX` and a compare-and-delete `EVAL` for release), so this validates
 * the real lock algorithm, not a trivial stub. It does not exercise a live network connection —
 * that would require an integration-test tier this repo doesn't currently have.
 */
describe('GoogleTokenManager cross-replica distributed lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function installFakeRedis() {
    const store = new Map<string, { value: string; expiresAt: number }>();

    vi.spyOn(redisConnection, 'set').mockImplementation(async (...args: unknown[]) => {
      const key = args[0] as string;
      const value = args[1] as string;
      const ttlMs = Number(args[3]);
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expiresAt > now) {
        return null as any; // Lock already held by someone else — NX semantics.
      }
      store.set(key, { value, expiresAt: now + ttlMs });
      return 'OK' as any;
    });

    vi.spyOn(redisConnection, 'eval').mockImplementation(async (...args: unknown[]) => {
      const key = args[2] as string;
      const token = args[3] as string;
      const existing = store.get(key);
      if (existing && existing.value === token) {
        store.delete(key);
        return 1 as any;
      }
      return 0 as any;
    });

    return store;
  }

  function installStatefulAccountDb(initialAccount: Record<string, unknown>) {
    let current = { ...initialAccount };

    vi.spyOn(db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockImplementation(async () => [{ ...current }]),
            }),
          }),
        }) as any,
    );

    const updateSetMock = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      current = { ...current, ...patch };
      return { where: vi.fn().mockResolvedValue([]) };
    });
    vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);

    return { getCurrent: () => current };
  }

  it('serializes refresh across two independent GoogleTokenManager instances (simulated replicas): Google is called exactly once', async () => {
    installFakeRedis();

    const soonExpiry = new Date(Date.now() + 60 * 1000); // within the 5-minute buffer
    const { getCurrent } = installStatefulAccountDb({
      id: 'acc-cross-replica',
      userId: 'user-1',
      email: 'replica-test@example.com',
      accessToken: 'enc-old-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: soonExpiry,
      status: 'active',
    });

    vi.spyOn(encryptionUtils, 'decrypt').mockImplementation((v: string) => `decrypted-${v}`);
    vi.spyOn(encryptionUtils, 'encrypt').mockImplementation((v: string) => `encrypted-${v}`);

    const refreshSpy = vi.fn().mockImplementation(async () => {
      // Simulated real network latency to Google — long enough to prove the second
      // "replica" genuinely waits on the lock rather than racing through.
      await new Promise((resolve) => setTimeout(resolve, 60));
      return {
        credentials: {
          access_token: 'fresh-token-from-google',
          expiry_date: Date.now() + 3600 * 1000,
        },
      };
    });
    vi.spyOn(googleOAuthUtils, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: refreshSpy,
    } as any);

    // Two INDEPENDENT instances = two independent in-process mutexes, exactly like two
    // separate server replicas that only share Postgres and Redis, not JS heap state.
    const replicaA = new GoogleTokenManager();
    const replicaB = new GoogleTokenManager();

    const [resultA, resultB] = await Promise.all([
      replicaA.getValidOAuth2Client('acc-cross-replica'),
      replicaB.getValidOAuth2Client('acc-cross-replica'),
    ]);

    expect(resultA).not.toBeNull();
    expect(resultB).not.toBeNull();

    // Neither replica should have taken the invalid_grant/revoked error path due to the race.
    expect(getCurrent().status).toBe('active');

    // The whole point of the lock: Google's refresh endpoint is called exactly once across
    // BOTH replicas, never twice for the same account at the same time.
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    // Exactly one replica performed the actual refresh; the other must have re-read the
    // now-fresh token from Postgres after acquiring the lock, instead of refreshing again.
    const refreshedFlags = [resultA?.refreshed, resultB?.refreshed];
    expect(refreshedFlags.filter(Boolean)).toHaveLength(1);
  });

  it('does not falsely mark the account revoked when a second replica only lost the lock race (no real invalid_grant)', async () => {
    installFakeRedis();

    const soonExpiry = new Date(Date.now() + 60 * 1000);
    const { getCurrent } = installStatefulAccountDb({
      id: 'acc-no-false-revoke',
      userId: 'user-1',
      email: 'no-false-revoke@example.com',
      accessToken: 'enc-old-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: soonExpiry,
      status: 'active',
    });

    vi.spyOn(encryptionUtils, 'decrypt').mockImplementation((v: string) => `decrypted-${v}`);
    vi.spyOn(encryptionUtils, 'encrypt').mockImplementation((v: string) => `encrypted-${v}`);

    const refreshSpy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { credentials: { access_token: 'fresh-token', expiry_date: Date.now() + 3600 * 1000 } };
    });
    vi.spyOn(googleOAuthUtils, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: refreshSpy,
    } as any);

    const replicaA = new GoogleTokenManager();
    const replicaB = new GoogleTokenManager();

    await Promise.all([
      replicaA.getValidOAuth2Client('acc-no-false-revoke'),
      replicaB.getValidOAuth2Client('acc-no-false-revoke'),
    ]);

    // Without the lock, the second replica would have reused the same (now possibly
    // rotated-out) refresh token concurrently and could have been handed invalid_grant by
    // Google — incorrectly flipping status to 'error'. With the lock, that never happens.
    expect(getCurrent().status).toBe('active');
  });

  it('degrades gracefully (no hang, no crash) when Redis itself is unavailable', async () => {
    vi.spyOn(redisConnection, 'set').mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(redisConnection, 'eval').mockRejectedValue(new Error('ECONNREFUSED'));

    const soonExpiry = new Date(Date.now() + 60 * 1000);
    installStatefulAccountDb({
      id: 'acc-redis-down',
      userId: 'user-1',
      email: 'redis-down@example.com',
      accessToken: 'enc-old-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: soonExpiry,
      status: 'active',
    });

    vi.spyOn(encryptionUtils, 'decrypt').mockImplementation((v: string) => `decrypted-${v}`);
    vi.spyOn(encryptionUtils, 'encrypt').mockImplementation((v: string) => `encrypted-${v}`);

    const refreshSpy = vi.fn().mockResolvedValue({
      credentials: { access_token: 'fresh-token', expiry_date: Date.now() + 3600 * 1000 },
    });
    vi.spyOn(googleOAuthUtils, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: refreshSpy,
    } as any);

    const replica = new GoogleTokenManager();
    const result = await replica.getValidOAuth2Client('acc-redis-down');

    // Redis being down must not block or crash token refresh — it should proceed
    // best-effort, protected only by the (still-functioning) in-process mutex.
    expect(result).not.toBeNull();
    expect(result?.refreshed).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});
