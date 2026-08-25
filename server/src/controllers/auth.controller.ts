import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    const result = await authService.register(email, password, name);
    res.cookie('session_token', result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000 });
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    logger.error({ err }, 'Register controller error');
    res.status(400).json({ error: message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    const result = await authService.login(email, password);
    res.cookie('session_token', result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000 });
    res.json(result);
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
    res.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'User fetch failed';
    res.status(404).json({ error: message });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Logged out successfully.' });
}
