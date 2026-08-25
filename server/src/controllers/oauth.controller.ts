import { Response } from 'express';
import { oauthService } from '../services/oauth.service.js';
import { getAuthUrl } from '../utils/google-oauth.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function connectGoogle(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (err: unknown) {
    logger.error({ err }, 'Google connect error');
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
}

export async function googleCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code is missing.' });
      return;
    }

    const userId = req.user?.id || 'demo-user';
    await oauthService.handleGoogleCallback(code, userId);
    res.redirect(`${env.CLIENT_URL}/inbox?accountConnected=true`);
  } catch (err: unknown) {
    logger.error({ err }, 'Google callback error');
    res.redirect(`${env.CLIENT_URL}/inbox?error=oauth_failed`);
  }
}

export async function listAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'demo-user';
    const accounts = await oauthService.getAccounts(userId);
    res.json({ accounts });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to list accounts' });
  }
}

export async function updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ success: true });
}

export async function disconnectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'demo-user';
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await oauthService.disconnectAccount(id, userId);
    res.json({ success: true, message: 'Account disconnected successfully' });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
}
