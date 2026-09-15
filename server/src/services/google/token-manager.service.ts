import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { db } from '../../db/index.js';
import { connectedAccounts, syncStates } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { createOAuth2Client } from '../../utils/google-oauth.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { auditService } from '../audit.service.js';

export interface AuthenticatedClientResult {
  oauth2Client: OAuth2Client;
  account: typeof connectedAccounts.$inferSelect;
  refreshed: boolean;
}

/**
 * Proactive OAuth Token Lifecycle & Refresh Mutex Manager.
 *
 * Solves:
 * 1. Thundering herd race conditions: When concurrent worker jobs (Gmail sync, Calendar sync,
 *    Contacts sync) simultaneously detect an expiring token, requests are serialized via a singleflight
 *    in-flight promise map keyed by accountId.
 * 2. Proactive refresh: Refreshes access tokens 5 minutes before expiration to prevent 401s
 *    midway through batch operations.
 * 3. Terminal error handling: Detects `invalid_grant` / revoked tokens, automatically updates
 *    account status to 'error', flags syncStates, and records an audit trail.
 */
export class GoogleTokenManager {
  // Proactive refresh buffer: 5 minutes in milliseconds
  private readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000;

  // Single-flight in-memory mutex to deduplicate concurrent requests for the same account
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

  private async resolveClient(accountId: string): Promise<AuthenticatedClientResult | null> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
      .limit(1);

    if (!account) {
      logger.warn({ accountId }, 'Account not found when obtaining OAuth2 client');
      return null;
    }

    let accessToken = decrypt(account.accessToken);
    const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;
    const expiresAtMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
    const isExpiringSoon = expiresAtMs < Date.now() + this.EXPIRY_BUFFER_MS;

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiresAtMs || undefined,
    });

    // If token is still fresh, return immediately
    if (!isExpiringSoon || !refreshToken) {
      return {
        oauth2Client,
        account,
        refreshed: false,
      };
    }

    return this.executeTokenRefresh(account, oauth2Client, refreshToken);
  }

  /**
   * Executes the token refresh with Google OAuth API, persists new credentials,
   * and handles terminal failure scenarios.
   */
  private async executeTokenRefresh(
    account: typeof connectedAccounts.$inferSelect,
    oauth2Client: OAuth2Client,
    refreshToken: string
  ): Promise<AuthenticatedClientResult> {
    const accountId = account.id;
    logger.info({ accountId, email: account.email }, 'Google OAuth access token expired or expiring soon. Refreshing...');

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        oauth2Client.setCredentials(credentials);
        const newEncryptedAccess = encrypt(credentials.access_token);
        const newExpiresAt = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);

        // Also update refresh token if Google rotated it
        const newEncryptedRefresh = credentials.refresh_token
          ? encrypt(credentials.refresh_token)
          : undefined;

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
    } catch (refreshErr: any) {
      logger.error({ refreshErr, accountId }, 'Failed to refresh Google OAuth token');
      const errString = String(refreshErr?.message || refreshErr || '');

      if (
        errString.includes('invalid_grant') ||
        errString.includes('revoked') ||
        refreshErr?.status === 400 ||
        refreshErr?.status === 401
      ) {
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
