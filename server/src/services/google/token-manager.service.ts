import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { db } from '../../db/index.js';
import { connectedAccounts, syncStates } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { createOAuth2Client } from '../../utils/google-oauth.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { auditService } from '../audit.service.js';
import { toError } from '../../utils/errors.js';
import { withRetryAndTimeout } from '../../utils/resilience.js';
import { withDistributedLock } from '../../utils/distributed-lock.js';

export interface AuthenticatedClientResult {
  oauth2Client: OAuth2Client;
  account: typeof connectedAccounts.$inferSelect;
  refreshed: boolean;
}

type ConnectedAccount = typeof connectedAccounts.$inferSelect;

/**
 * Proactive OAuth Token Lifecycle & Refresh Mutex Manager.
 *
 * Solves:
 * 1. Thundering herd race conditions within ONE process: concurrent worker jobs (Gmail sync,
 *    Calendar sync, Contacts sync) simultaneously detecting an expiring token are serialized via
 *    a singleflight in-flight promise map keyed by accountId. This alone does NOT protect two
 *    server replicas (separate processes/containers) from racing on the same account — see (4).
 * 2. Proactive refresh: Refreshes access tokens 5 minutes before expiration to prevent 401s
 *    midway through batch operations.
 * 3. Terminal error handling: Detects `invalid_grant` / revoked tokens, automatically updates
 *    account status to 'error', flags syncStates, and records an audit trail.
 * 4. Cross-replica race protection: Google can rotate refresh tokens on use. If two replicas
 *    both read the same (still-valid) refresh token and both call Google's refresh endpoint
 *    concurrently, whichever call lands second can be handed `invalid_grant` for a token that
 *    was never actually revoked by the user — just consumed by the other replica a moment
 *    earlier. That failure path marks the account 'error' and demands reconnection, a false
 *    lockout caused purely by the race, not a real revocation. A Redis-backed distributed lock
 *    (keyed per accountId) plus a double-checked re-read of the account after acquiring it
 *    closes this gap: only one replica ever calls Google, and any replica that had to wait for
 *    the lock re-reads the (now-fresh) token from Postgres instead of refreshing again.
 */
export class GoogleTokenManager {
  // Proactive refresh buffer: 5 minutes in milliseconds
  private readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000;

  // Distributed lock TTL must comfortably exceed the worst-case refresh duration:
  // withRetryAndTimeout below runs up to 3 attempts (maxRetries: 2) at timeoutMs=10000 each,
  // plus backoff between attempts — worst case is ~32s. 45s leaves headroom.
  private readonly REFRESH_LOCK_TTL_MS = 45000;
  private readonly REFRESH_LOCK_MAX_WAIT_MS = 20000;

  // Single-flight in-memory mutex to deduplicate concurrent requests for the same account
  // WITHIN this process. Cross-process races are handled separately by the distributed lock.
  private readonly activeOperations = new Map<string, Promise<AuthenticatedClientResult | null>>();

  /**
   * Retrieves an authenticated Google OAuth2Client with a guaranteed fresh access token.
   * If the token is expired or within the 5-minute buffer, refreshes it safely.
   */
  async getValidOAuth2Client(accountId: string): Promise<AuthenticatedClientResult | null> {
    const existingOp = this.activeOperations.get(accountId);
    if (existingOp) {
      logger.debug({ accountId }, 'Concurrent token request joined in-flight operation');
      return existingOp;
    }

    const opPromise = this.resolveClient(accountId);
    this.activeOperations.set(accountId, opPromise);

    try {
      return await opPromise;
    } finally {
      this.activeOperations.delete(accountId);
    }
  }

  private async fetchAccount(accountId: string): Promise<ConnectedAccount | undefined> {
    const [account] = await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).limit(1);
    return account;
  }

  private decryptTokens(account: ConnectedAccount): { accessToken: string; refreshToken?: string } | null {
    try {
      return {
        accessToken: decrypt(account.accessToken),
        refreshToken: account.refreshToken ? decrypt(account.refreshToken) : undefined,
      };
    } catch (decryptErr: unknown) {
      const err = toError(decryptErr);
      logger.warn({ accountId: account.id, err: err.message }, 'Failed to decrypt account OAuth credentials');
      return null;
    }
  }

  private isExpiringSoon(account: ConnectedAccount): boolean {
    const expiresAtMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
    return expiresAtMs < Date.now() + this.EXPIRY_BUFFER_MS;
  }

  private buildClient(
    account: ConnectedAccount,
    accessToken: string,
    refreshToken: string | undefined,
    refreshed: boolean,
  ): AuthenticatedClientResult {
    const expiresAtMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : undefined;
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiresAtMs,
    });
    return { oauth2Client, account, refreshed };
  }

  private async resolveClient(accountId: string): Promise<AuthenticatedClientResult | null> {
    try {
      const account = await this.fetchAccount(accountId);
      if (!account) {
        logger.warn({ accountId }, 'Account not found when obtaining OAuth2 client');
        return null;
      }

      const decrypted = this.decryptTokens(account);
      if (!decrypted) return null;

      // If token is still fresh, return immediately — no lock needed for the common case.
      if (!this.isExpiringSoon(account) || !decrypted.refreshToken) {
        return this.buildClient(account, decrypted.accessToken, decrypted.refreshToken, false);
      }

      // Token needs refreshing. Acquire a cross-replica lock before calling Google, so two
      // replicas never race on the same account's (possibly single-use, rotating) refresh token.
      const lockKey = `lock:google-oauth-refresh:${accountId}`;
      const { result, lockAcquired, degraded, timedOutWaiting } = await withDistributedLock(
        lockKey,
        this.REFRESH_LOCK_TTL_MS,
        () => this.refreshUnderLock(accountId, decrypted.refreshToken as string),
        { maxWaitMs: this.REFRESH_LOCK_MAX_WAIT_MS },
      );

      logger.debug(
        { accountId, lockAcquired, degraded, timedOutWaiting },
        'Google OAuth refresh completed distributed-lock cycle',
      );

      return result;
    } catch (err: unknown) {
      const error = toError(err);
      logger.error({ accountId, err: error.message }, 'Error in OAuth client resolution');
      return null;
    }
  }

  /**
   * Runs inside the distributed lock (or best-effort without one if Redis was unavailable/timed
   * out waiting). Re-reads the account first: if another replica already refreshed it while we
   * were waiting for the lock, this returns the already-fresh token instead of calling Google
   * again.
   */
  private async refreshUnderLock(
    accountId: string,
    fallbackRefreshToken: string,
  ): Promise<AuthenticatedClientResult | null> {
    const freshAccount = await this.fetchAccount(accountId);
    if (!freshAccount) {
      logger.warn({ accountId }, 'Account disappeared while waiting for OAuth refresh lock');
      return null;
    }

    const freshDecrypted = this.decryptTokens(freshAccount);
    if (!freshDecrypted) return null;

    if (!this.isExpiringSoon(freshAccount)) {
      logger.info(
        { accountId },
        'Another replica already refreshed this account\'s token while waiting for the lock — reusing it',
      );
      return this.buildClient(freshAccount, freshDecrypted.accessToken, freshDecrypted.refreshToken, false);
    }

    const refreshToken = freshDecrypted.refreshToken || fallbackRefreshToken;
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: freshDecrypted.accessToken,
      refresh_token: refreshToken,
    });

    return this.executeTokenRefresh(freshAccount, oauth2Client, refreshToken);
  }

  /**
   * Executes the token refresh with Google OAuth API, persists new credentials,
   * and handles terminal failure scenarios.
   */
  private async executeTokenRefresh(
    account: typeof connectedAccounts.$inferSelect,
    oauth2Client: OAuth2Client,
    refreshToken: string,
  ): Promise<AuthenticatedClientResult> {
    const accountId = account.id;
    logger.info(
      { accountId, email: account.email },
      'Google OAuth access token expired or expiring soon. Refreshing...',
    );

    try {
      const { credentials } = await withRetryAndTimeout(async () => oauth2Client.refreshAccessToken(), {
        timeoutMs: 10000,
        maxRetries: 2,
        backoffBaseMs: 500,
        operationName: `google_oauth_refresh_${accountId}`,
        shouldRetry: (err) => {
          const msg = toError(err).message.toLowerCase();
          if (msg.includes('invalid_grant') || msg.includes('revoked')) {
            return false;
          }
          return true;
        },
      });

      if (credentials.access_token) {
        oauth2Client.setCredentials(credentials);
        const newEncryptedAccess = encrypt(credentials.access_token);
        const newExpiresAt = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);

        // Also update refresh token if Google rotated it
        const newEncryptedRefresh = credentials.refresh_token ? encrypt(credentials.refresh_token) : undefined;

        await db
          .update(connectedAccounts)
          .set({
            accessToken: newEncryptedAccess,
            ...(newEncryptedRefresh ? { refreshToken: newEncryptedRefresh } : {}),
            tokenExpiresAt: newExpiresAt,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));

        logger.info({ accountId }, 'Google OAuth token refreshed and persisted successfully');

        return {
          oauth2Client,
          account: {
            ...account,
            accessToken: newEncryptedAccess,
            tokenExpiresAt: newExpiresAt,
            status: 'active',
          },
          refreshed: true,
        };
      }

      return { oauth2Client, account, refreshed: false };
    } catch (rawRefreshErr: unknown) {
      const refreshErr = toError(rawRefreshErr);
      logger.error({ err: refreshErr.message, accountId }, 'Failed to refresh Google OAuth token');
      const errString = refreshErr.message;
      const status = (rawRefreshErr as { status?: number })?.status;

      if (errString.includes('invalid_grant') || errString.includes('revoked') || status === 400 || status === 401) {
        logger.warn({ accountId }, 'Detected revoked or invalid Google OAuth grant. Marking account as error');

        await db
          .update(connectedAccounts)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(connectedAccounts.id, accountId));

        await db
          .update(syncStates)
          .set({
            status: 'error',
            lastError: 'OAuth token revoked or expired. Reconnection required.',
            lastSyncedAt: new Date(),
          })
          .where(eq(syncStates.accountId, accountId));

        await auditService.logAction(account.userId, 'account.token_revocation_error', {
          accountId,
          email: account.email,
          error: errString,
        });
      }

      // Return existing client so best-effort execution can attempt or propagate proper error
      return { oauth2Client, account, refreshed: false };
    }
  }

  /**
   * Helper returning an authenticated Gmail API client.
   */
  async getGmailClient(accountId: string) {
    const result = await this.getValidOAuth2Client(accountId);
    if (!result) return null;
    return {
      gmail: google.gmail({ version: 'v1', auth: result.oauth2Client }),
      account: result.account,
      oauth2Client: result.oauth2Client,
      refreshed: result.refreshed,
    };
  }

  /**
   * Helper returning an authenticated Google Calendar API client.
   */
  async getCalendarClient(accountId: string) {
    const result = await this.getValidOAuth2Client(accountId);
    if (!result) return null;
    return {
      calendar: google.calendar({ version: 'v3', auth: result.oauth2Client }),
      account: result.account,
      oauth2Client: result.oauth2Client,
      refreshed: result.refreshed,
    };
  }
}

export const googleTokenManager = new GoogleTokenManager();
