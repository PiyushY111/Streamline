import helmet from 'helmet';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://www.googleapis.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
});

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Double-submit cookie CSRF protection middleware for cookie-authenticated sessions.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe read methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt Google OAuth callback (which uses its own state parameter verification)
  if (req.path === '/api/auth/google/callback' || req.path === '/auth/google/callback') {
    return next();
  }

  // If request is authenticated via Cookie (ambient credentials), enforce CSRF check
  const sessionCookie = req.cookies?.session_token;
  const authHeader = req.headers.authorization;

  // Only enforce CSRF if session cookie is present and Authorization Bearer header is absent
  if (sessionCookie && !authHeader?.startsWith('Bearer ')) {
    const csrfCookie = req.cookies?.csrf_token;
    const csrfHeader = req.headers['x-csrf-token'] as string;

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      res.status(403).json({
        error: 'CSRF token validation failed. Missing or mismatched X-CSRF-Token header.',
      });
      return;
    }
  }

  next();
}
