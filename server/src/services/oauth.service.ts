import { accountsRepository } from '../repositories/accounts.repository.js';
import { createOAuth2Client } from '../utils/google-oauth.js';
import { encrypt } from '../utils/encryption.js';

export class OAuthService {
  async getAccounts(userId: string) {
    return accountsRepository.findByUserId(userId);
  }

  async disconnectAccount(id: string, userId: string) {
    return accountsRepository.delete(id, userId);
  }

  async handleGoogleCallback(code: string, userId: string) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = createOAuth2Client();
    oauth2.setCredentials(tokens);
    const userInfoRes = await oauth2.request<{ id: string; email: string; name?: string; picture?: string }>({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });

    const profile = userInfoRes.data;
    const encryptedAccess = encrypt(tokens.access_token!);
    const encryptedRefresh = encrypt(tokens.refresh_token || tokens.access_token!);
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

    return accountsRepository.upsertAccount({
      userId,
      providerAccountId: profile.id,
      email: profile.email,
      label: profile.email.split('@')[0],
      color: '#3b82f6',
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope || '',
      avatar: profile.picture,
    });
  }
}

export const oauthService = new OAuthService();
