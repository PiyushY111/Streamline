import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleTokenManager } from '../services/google/token-manager.service.js';
import { db } from '../db/index.js';
import * as encryption from '../utils/encryption.js';
import * as googleOAuth from '../utils/google-oauth.js';
import { auditService } from '../services/audit.service.js';

describe('OAuth 2.0 Token Lifecycle & Refresh Mutex Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid client without refreshing if token expiration is beyond 5-minute buffer', async () => {
    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 mins ahead
    const mockAccount = {
      id: 'acc-123',
      userId: 'user-1',
      email: 'alex@example.com',
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: futureExpiry,
      status: 'active',
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockAccount]),
        }),
      }),
    } as any);

    vi.spyOn(encryption, 'decrypt').mockImplementation((val) => `decrypted-${val}`);
    const mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn(),
    };
    vi.spyOn(googleOAuth, 'createOAuth2Client').mockReturnValue(mockOAuth2Client as any);

    const result = await googleTokenManager.getValidOAuth2Client('acc-123');

    expect(result).not.toBeNull();
    expect(result?.refreshed).toBe(false);
    expect(mockOAuth2Client.refreshAccessToken).not.toHaveBeenCalled();
    expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'decrypted-enc-access',
        refresh_token: 'decrypted-enc-refresh',
      }),
    );
  });

  it('proactively refreshes token if within 5-minute buffer and persists encrypted tokens', async () => {
    const soonExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 mins ahead (within 5 min buffer)
    const mockAccount = {
      id: 'acc-456',
      userId: 'user-1',
      email: 'alex@example.com',
      accessToken: 'enc-old-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: soonExpiry,
      status: 'active',
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockAccount]),
        }),
      }),
    } as any);

    const updateWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);

    vi.spyOn(encryption, 'decrypt').mockImplementation((val) => `decrypted-${val}`);
    vi.spyOn(encryption, 'encrypt').mockImplementation((val) => `encrypted-${val}`);

    const newExpiry = Date.now() + 3600 * 1000;
    const mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue({
        credentials: {
          access_token: 'new-raw-access-token',
          expiry_date: newExpiry,
        },
      }),
    };
    vi.spyOn(googleOAuth, 'createOAuth2Client').mockReturnValue(mockOAuth2Client as any);

    const result = await googleTokenManager.getValidOAuth2Client('acc-456');

    expect(result).not.toBeNull();
    expect(result?.refreshed).toBe(true);
    expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalled();
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'encrypted-new-raw-access-token',
        status: 'active',
      }),
    );
  });

  it('deduplicates concurrent refresh requests using singleflight mutex', async () => {
    const soonExpiry = new Date(Date.now() + 60 * 1000); // 1 min ahead
    const mockAccount = {
      id: 'acc-mutex',
      userId: 'user-1',
      email: 'concurrent@example.com',
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: soonExpiry,
      status: 'active',
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockAccount]),
        }),
      }),
    } as any);

    const updateWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);

    vi.spyOn(encryption, 'decrypt').mockImplementation((val) => `decrypted-${val}`);
    vi.spyOn(encryption, 'encrypt').mockImplementation((val) => `encrypted-${val}`);

    let refreshResolve: any;
    const slowRefreshPromise = new Promise((resolve) => {
      refreshResolve = resolve;
    });

    const mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn().mockImplementation(() =>
        slowRefreshPromise.then(() => ({
          credentials: {
            access_token: 'concurrent-refreshed-token',
            expiry_date: Date.now() + 3600 * 1000,
          },
        })),
      ),
    };
    vi.spyOn(googleOAuth, 'createOAuth2Client').mockReturnValue(mockOAuth2Client as any);

    // Trigger two calls simultaneously
    const promise1 = googleTokenManager.getValidOAuth2Client('acc-mutex');
    const promise2 = googleTokenManager.getValidOAuth2Client('acc-mutex');

    // Resolve the simulated slow Google OAuth API response
    refreshResolve();

    const [res1, res2] = await Promise.all([promise1, promise2]);

    // Both should succeed and receive the refreshed client
    expect(res1?.refreshed).toBe(true);
    expect(res2?.refreshed).toBe(true);
    // Crucially: refreshAccessToken must have only been called once due to the singleflight mutex!
    expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('detects invalid_grant or revoked token, flags account status as error, and logs audit record', async () => {
    const expiredDate = new Date(Date.now() - 1000); // Expired
    const mockAccount = {
      id: 'acc-revoked',
      userId: 'user-1',
      email: 'revoked@example.com',
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      tokenExpiresAt: expiredDate,
      status: 'active',
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockAccount]),
        }),
      }),
    } as any);

    const updateWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);
    vi.spyOn(auditService, 'logAction').mockResolvedValue(undefined as any);

    vi.spyOn(encryption, 'decrypt').mockImplementation((val) => `decrypted-${val}`);

    const mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn().mockRejectedValue({
        message: 'invalid_grant: Token has been expired or revoked.',
        status: 400,
      }),
    };
    vi.spyOn(googleOAuth, 'createOAuth2Client').mockReturnValue(mockOAuth2Client as any);

    const result = await googleTokenManager.getValidOAuth2Client('acc-revoked');

    expect(result).not.toBeNull();
    expect(result?.refreshed).toBe(false);
    expect(db.update).toHaveBeenCalled();
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
      }),
    );
    expect(auditService.logAction).toHaveBeenCalledWith(
      'user-1',
      'account.token_revocation_error',
      expect.objectContaining({
        accountId: 'acc-revoked',
      }),
    );
  });
});
