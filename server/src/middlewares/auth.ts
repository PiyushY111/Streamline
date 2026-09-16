import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies?.session_token || (typeof req.query?.token === 'string' ? req.query.token : undefined);

  if (!token) {
    if (typeof next === 'function') {
      return next(new UnauthorizedError('Authentication required. No session token provided.'));
    }
    res.status(401).json({ error: 'Authentication required. No session token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    if (typeof next === 'function') {
      return next(new UnauthorizedError('Invalid or expired session token.'));
    }
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}
