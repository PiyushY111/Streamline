import { Request, Response } from 'express';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, connectedAccounts, syncStates, auditLogs } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  revokeGoogleToken,
} from '../utils/google-oauth.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { syncGoogleAccountData } from '../services/google-sync.service.js';
import { logger } from '../utils/logger.js';

const COLOR_PALETTE = ['#ec4899', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#06b6d4'];

// Helper to ensure a primary user exists in single-user / dev mode if unauthenticated
async function getOrCreateDefaultUser() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    return existingUsers[0];
  }
  const [newUser] = await db.insert(users).values({
    email: 'piyush@streamline.app',
    name: 'Piyush',
  }).returning();
  return newUser;
}

// 1. Initiate Google OAuth Flow (PKCE + CSRF state)
export async function connectGoogle(req: Request, res: Response): Promise<void> {
  try {
    const state = crypto.randomBytes(24).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Set short-lived secure httpOnly cookies for OAuth state and PKCE verifier
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    res.cookie('oauth_verifier', codeVerifier, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const googleAuthUrl = getGoogleAuthUrl(state, codeChallenge);
    logger.info('Initiating Google OAuth flow URL...');

    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      res.json({ url: googleAuthUrl });
      return;
    }

    res.redirect(302, googleAuthUrl);
  } catch (err: any) {
    logger.error({ err }, 'Failed to initiate Google OAuth flow');
    res.status(500).json({ error: 'Failed to initiate OAuth authorization flow' });
  }
}

// 2. Handle Google OAuth Callback
export async function googleCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn({ error }, 'Google OAuth consent denied by user');
    res.redirect(`http://localhost:3000/settings?error=${encodeURIComponent(String(error))}`);
    return;
  }

  const savedState = req.cookies.oauth_state;
  const codeVerifier = req.cookies.oauth_verifier;

  // Clear state cookies immediately
  res.clearCookie('oauth_state');
  res.clearCookie('oauth_verifier');

  if (!state || state !== savedState) {
    logger.error({ state, savedState }, 'CSRF state verification failed during OAuth callback');
    res.status(400).send('CSRF state verification failed. Authorization attempt aborted.');
    return;
  }

  if (!code || typeof code !== 'string' || !codeVerifier) {
    logger.error('Missing code or PKCE code verifier in OAuth callback');
    res.status(400).send('Invalid authorization code or missing PKCE code verifier.');
    return;
  }

  try {
    // Exchange code for tokens and Google profile
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier);

    // Get current logged-in user or default user
    let userId = req.user?.id;
    if (!userId) {
      const defaultUser = await getOrCreateDefaultUser();
      userId = defaultUser.id;
    }

    // Encrypt access token and refresh token at rest using AES-256-GCM
    const encryptedAccessToken = encrypt(tokenResult.accessToken);
    const encryptedRefreshToken = tokenResult.refreshToken ? encrypt(tokenResult.refreshToken) : '';

    // Assign color badge tag based on existing account count
    const existingAccounts = await db.select().from(connectedAccounts).where(eq(connectedAccounts.userId, userId));
    const assignedColor = COLOR_PALETTE[existingAccounts.length % COLOR_PALETTE.length];
    const accountLabel = tokenResult.profile.email.includes('gmail.com') ? 'Personal Gmail' : 'Work Account';

    // Upsert connected account record
    const existingAccountIndex = existingAccounts.findIndex(
      (a) => a.providerAccountId === tokenResult.profile.providerAccountId
    );

    let accountId: string;

    if (existingAccountIndex >= 0) {
      const targetAccount = existingAccounts[existingAccountIndex];
      accountId = targetAccount.id;

      await db.update(connectedAccounts)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken || targetAccount.refreshToken,
          tokenExpiresAt: tokenResult.tokenExpiresAt,
          status: 'active',
          scopes: tokenResult.scopes,
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, accountId));

      logger.info({ accountId, email: tokenResult.profile.email }, 'Updated existing connected Google account credentials');
    } else {
      const [newAccount] = await db.insert(connectedAccounts).values({
        userId,
        provider: 'google',
        providerAccountId: tokenResult.profile.providerAccountId,
        email: tokenResult.profile.email,
        label: accountLabel,
        color: assignedColor,
        avatar: tokenResult.profile.picture,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResult.tokenExpiresAt,
        scopes: tokenResult.scopes,
        status: 'active',
      }).returning();

      accountId = newAccount.id;
      logger.info({ accountId, email: tokenResult.profile.email }, 'Connected new Google account successfully');
    }

    // Initialize sync_states rows for gmail and calendar
    for (const service of ['gmail', 'calendar']) {
      await db.insert(syncStates).values({
        accountId,
        service,
        status: 'idle',
      }).onConflictDoNothing();
    }

    // Insert immutable audit log entry
    await db.insert(auditLogs).values({
      userId,
      action: 'account.connected',
      meta: {
        accountId,
        email: tokenResult.profile.email,
        provider: 'google',
      },
    });

    logger.info({ accountId }, 'Triggering non-blocking initial live sync for Gmail & Calendar...');
    syncGoogleAccountData(accountId).catch((err) => {
      logger.error({ err, accountId }, 'Background initial sync failed');
    });

    res.redirect(`http://localhost:3000/settings?connected=success&email=${encodeURIComponent(tokenResult.profile.email)}`);
  } catch (err: any) {
    logger.error({ err }, 'Error handling Google OAuth callback');
    res.redirect(`http://localhost:3000/settings?error=${encodeURIComponent(err.message || 'OAuth callback failed')}`);
  }
}

// 3. List Connected Accounts (Row-Level Security Scoped, Tokens Stripped)
export async function listAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let userId = req.user?.id;
    if (!userId) {
      const defaultUser = await getOrCreateDefaultUser();
      userId = defaultUser.id;
    }

    const accounts = await db
      .select({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    res.json({ accounts });
  } catch (err: any) {
    logger.error({ err }, 'Error listing connected accounts');
    res.status(500).json({ error: 'Failed to fetch connected accounts' });
  }
}

// 4. Update Connected Account Label/Color
export async function updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = String(req.params.id);
  const { label, color } = req.body;

  try {
    let userId = req.user?.id;
    if (!userId) {
      const defaultUser = await getOrCreateDefaultUser();
      userId = defaultUser.id;
    }

    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      res.status(404).json({ error: 'Connected account not found or access denied' });
      return;
    }

    const [updated] = await db
      .update(connectedAccounts)
      .set({
        label: label || account.label,
        color: color || account.color,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, accountId))
      .returning({
        id: connectedAccounts.id,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
      });

    res.json({ message: 'Account updated successfully', account: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error updating account');
    res.status(500).json({ error: 'Failed to update account' });
  }
}

// 5. Disconnect Account (Token Revocation + Cascading Hard Delete + Audit Log)
export async function disconnectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const accountId = String(req.params.id);

  try {
    let userId = req.user?.id;
    if (!userId) {
      const defaultUser = await getOrCreateDefaultUser();
      userId = defaultUser.id;
    }

    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      res.status(404).json({ error: 'Connected account not found or access denied' });
      return;
    }

    // Revoke token with Google servers if refresh/access token is present
    if (account.refreshToken || account.accessToken) {
      try {
        const rawToken = account.refreshToken
          ? decrypt(account.refreshToken)
          : decrypt(account.accessToken);
        await revokeGoogleToken(rawToken);
      } catch (e) {
        logger.warn({ err: e }, 'Could not decrypt/revoke token during account disconnect');
      }
    }

    // Perform hard delete on connected_accounts row
    await db.delete(connectedAccounts).where(eq(connectedAccounts.id, accountId));

    // Immutable audit log write
    await db.insert(auditLogs).values({
      userId,
      action: 'account.disconnected',
      meta: {
        accountId,
        email: account.email,
      },
    });

    logger.info({ accountId, email: account.email }, 'Disconnected Google account and deleted synced records');
    res.json({ message: 'Account disconnected successfully', accountId });
  } catch (err: any) {
    logger.error({ err }, 'Error disconnecting account');
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
}
