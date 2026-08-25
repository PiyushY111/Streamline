import { google } from 'googleapis';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback'
  );
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    ...(state ? { state } : {}),
  });
}

export function getGoogleAuthUrl(state: string, codeChallenge: string): string {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256' as any,
  });
}

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string;
  profile: GoogleProfile;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<GoogleTokenResult> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken({ code, codeVerifier });

  if (!tokens.access_token) {
    throw new Error('Google OAuth failed to return access token');
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  if (!userInfo.email || !userInfo.id) {
    throw new Error('Failed to retrieve user profile from Google OAuth');
  }

  const tokenExpiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    tokenExpiresAt,
    scopes: tokens.scope || '',
    profile: {
      providerAccountId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name || undefined,
      picture: userInfo.picture || undefined,
    },
  };
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    const oauth2Client = createOAuth2Client();
    await oauth2Client.revokeToken(token);
    logger.info('Google OAuth token revoked successfully');
  } catch (err) {
    logger.warn({ err }, 'Failed to revoke Google token with Google servers');
  }
}
