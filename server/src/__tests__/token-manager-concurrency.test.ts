import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleTokenManager } from '../services/google/token-manager.service.js';
import { db } from '../db/index.js';
import * as googleOAuthUtils from '../utils/google-oauth.js';
import * as encryptionUtils from '../utils/encryption.js';

describe('TokenManager Single-Flight Mutex Concurrency Stress Test', () => {
  const mockAccountId = '00000000-0000-4000-a000-000000000099';
  const mockUserId = '00000000-0000-4000-a000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes 50 concurrent requests (thundering herd) for an expiring token and invokes Google refresh API exactly once', async () => {
    const expiredAccount = {
      id: mockAccountId,
      userId: mockUserId,
      email: 'stress-test@example.com',
      accessToken: 'encrypted-old-access',
      refreshToken: 'encrypted-refresh-token',
      tokenExpiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
      status: 'active',
      label: 'Personal',
      color: '#3b82f6',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock DB select to return expired account
    vi.spyOn(db, 'select').mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([expiredAccount]),
        }),
      }),
    } as any);

    // Mock DB update for persistence
    const updateSetMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    vi.spyOn(db, 'update').mockReturnValue({
      set: updateSetMock,
    } as any);

    // Mock encryption / decryption
    vi.spyOn(encryptionUtils, 'decrypt').mockReturnValue('decrypted-plain-token');
    vi.spyOn(encryptionUtils, 'encrypt').mockReturnValue('encrypted-new-access-token');

    // Mock OAuth client with simulated network latency of 40ms
    const refreshSpy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        credentials: {
          access_token: 'fresh-google-access-token-xyz',
          expiry_date: Date.now() + 3600 * 1000,
        },
      };
    });

    const mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: refreshSpy,
    };

    vi.spyOn(googleOAuthUtils, 'createOAuth2Client').mockReturnValue(mockOAuth2Client as any);

    // Fire 50 concurrent callers simultaneously (Thundering Herd)
    const CONCURRENT_CALLERS = 50;
    const concurrentRequests = Array.from({ length: CONCURRENT_CALLERS }, () =>
      googleTokenManager.getValidOAuth2Client(mockAccountId),
    );

    const results = await Promise.all(concurrentRequests);

    // Invariant 1: All 50 callers received valid non-null results
    expect(results).toHaveLength(CONCURRENT_CALLERS);
    for (const res of results) {
      expect(res).not.toBeNull();
      expect(res?.refreshed).toBe(true);
      expect(res?.account.id).toBe(mockAccountId);
    }

    // Invariant 2: Google's OAuth refresh endpoint was invoked EXACTLY ONCE
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    // Invariant 3: Database was updated EXACTLY ONCE with the new access token
    expect(updateSetMock).toHaveBeenCalledTimes(1);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'encrypted-new-access-token',
        status: 'active',
      }),
    );
  });

  it('handles error in single-flight execution cleanly and resets mutex for subsequent requests', async () => {
    const errorAccount = {
      id: 'error-account-id',
      userId: mockUserId,
      email: 'error@example.com',
      accessToken: 'encrypted-bad-access',
      refreshToken: 'encrypted-bad-refresh',
      tokenExpiresAt: new Date(Date.now() - 60 * 1000),
      status: 'active',
      label: 'Work',
      color: '#ef4444',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([errorAccount]),
        }),
      }),
    } as any);

    vi.spyOn(db, 'update').mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as any);

    vi.spyOn(encryptionUtils, 'decrypt').mockReturnValue('decrypted-token');

    const failingRefreshSpy = vi.fn().mockRejectedValue(new Error('Google network connection dropped'));
    vi.spyOn(googleOAuthUtils, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: failingRefreshSpy,
    } as any);

    // Fire 10 concurrent requests that will fail
    const concurrentCalls = Array.from({ length: 10 }, () =>
      googleTokenManager.getValidOAuth2Client('error-account-id'),
    );

    const results = await Promise.all(concurrentCalls);
    expect(results).toHaveLength(10);
    // Across all 10 concurrent callers, exactly 1 operation ran with its retry policy (1 initial + 2 retries = 3 calls)
    expect(failingRefreshSpy).toHaveBeenCalledTimes(3);

    // Ensure mutex is cleared and new request does not hang
    const subsequentCall = await googleTokenManager.getValidOAuth2Client('error-account-id');
    expect(subsequentCall).toBeDefined();
  });
});
