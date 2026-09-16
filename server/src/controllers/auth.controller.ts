import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { generateCsrfToken } from '../middlewares/security.js';
import { auditService } from '../services/audit.service.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { accountSyncQueue } from '../queues/index.js';
import { eq } from 'drizzle-orm';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  try {
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
    throw new BadRequestError(message);
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
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

    // Auto-queue background sync for user connected accounts on login
    db.select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, result.user.id))
      .then((accounts) => {
        for (const acc of accounts) {
          accountSyncQueue
            .add('sync-account', { accountId: acc.id }, { jobId: `account-sync-${acc.id}` })
            .catch(() => {});
        }
      })
      .catch(() => {});

    res.json({ ...result, csrfToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    throw new UnauthorizedError(message);
  }
});

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError('Unauthorized');
  }
  try {
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
    throw new NotFoundError(message);
  }
});

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.id) {
    await auditService.logAction(req.user.id, 'auth.logout', { ip: req.ip });
  }
  res.clearCookie('session_token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});
