import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { generateCsrfToken } from '../middlewares/security.js';
import { auditService } from '../services/audit.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name);
    const csrfToken = generateCsrfToken();

    const isProd = env.NODE_ENV === 'production';

    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });

    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });

    await auditService.logAction(result.user.id, 'auth.register', {
      email: result.user.email,
      ip: req.ip,
    });

    res.status(201).json({ ...result, csrfToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    logger.error({ err }, 'Register controller error');
    res.status(400).json({ error: message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    const csrfToken = generateCsrfToken();

    const isProd = env.NODE_ENV === 'production';

    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });

    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });

    await auditService.logAction(result.user.id, 'auth.login', {
      email: result.user.email,
      ip: req.ip,
    });

    res.json({ ...result, csrfToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    logger.error({ err }, 'Login controller error');
    res.status(401).json({ error: message });
  }
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await authService.getMe(req.user.id);
    let csrfToken = req.cookies?.csrf_token;
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 3600 * 1000,
        path: '/',
      });
    }
    res.json({ user, csrfToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'User fetch failed';
    res.status(404).json({ error: message });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.id) {
    await auditService.logAction(req.user.id, 'auth.logout', { ip: req.ip });
  }
  res.clearCookie('session_token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
}
