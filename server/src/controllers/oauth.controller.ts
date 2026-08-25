import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { oauthService } from '../services/oauth.service.js';
import { getAuthUrl } from '../utils/google-oauth.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function connectGoogle(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized. Please log in first.' });
      return;
    }
    const authUrl = getAuthUrl(req.user.id);
    res.redirect(authUrl);
  } catch (err: unknown) {
    logger.error({ err }, 'Google connect error');
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
}

export async function googleCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code is missing.' });
      return;
    }

    let userId: string | undefined = req.user?.id;

    if (!userId && typeof state === 'string' && state) {
      userId = state;
    }

    if (!userId && req.cookies?.session_token) {
      try {
        const decoded = jwt.verify(req.cookies.session_token, env.JWT_SECRET) as { id: string };
        if (decoded?.id) {
          userId = decoded.id;
        }
      } catch (err) {
        // Token invalid or expired
      }
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      logger.error({ userId }, 'Google callback error: Missing or invalid user ID');
      res.redirect(`${env.CLIENT_URL}/inbox?error=unauthorized`);
      return;
    }

    await oauthService.handleGoogleCallback(code, userId);
    res.redirect(`${env.CLIENT_URL}/inbox?accountConnected=true`);
  } catch (err: unknown) {
    logger.error({ err }, 'Google callback error');
    res.redirect(`${env.CLIENT_URL}/inbox?error=oauth_failed`);
  }
}

export async function listAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const accounts = await oauthService.getAccounts(req.user.id);
    res.json({ accounts });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to list accounts' });
  }
}

export async function updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { label, color } = req.body;
    const updated = await oauthService.updateAccount(id, req.user.id, { label, color });
    if (!updated) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ success: true, account: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update account' });
  }
}

export async function disconnectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await oauthService.disconnectAccount(id, req.user.id);
    res.json({ success: true, message: 'Account disconnected successfully' });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
}
