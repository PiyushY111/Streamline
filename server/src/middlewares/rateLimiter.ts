import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from './auth.js';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

/**
 * Helper to safely extract user ID from request, Bearer token, or cookies,
 * falling back to IP address for unauthenticated requests.
 */
function extractUserOrIpKey(req: AuthenticatedRequest): string {
  if (req.user?.id) {
    return req.user.id;
  }

  // Check Bearer authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const decoded = jwt.decode(token) as { id?: string; userId?: string } | null;
      if (decoded?.id) return decoded.id;
      if (decoded?.userId) return decoded.userId;
    } catch {
      // ignore token decode errors and fall back to IP
    }
  }

  // Check session token cookie
  if (req.cookies?.session_token) {
    try {
      const decoded = jwt.decode(req.cookies.session_token) as { id?: string; userId?: string } | null;
      if (decoded?.id) return decoded.id;
      if (decoded?.userId) return decoded.userId;
    } catch {
      // ignore
    }
  }

  return req.ip ? ipKeyGenerator(req.ip) : 'anonymous';
}

// Rate limiter for authentication routes (login, register)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 30, // 100 in dev, 30 in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

// IP Tier (Unauthenticated traffic protection)
export const ipTierLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 1000 : 300, // 1000 req/min in dev, 300 in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded for IP. Please slow down.',
  },
});

// Alias for general API IP-level limiter
export const apiRateLimiter = ipTierLimiter;

// Authenticated User Tier (high-throughput for rich dashboard SPAs)
export const userTierLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 2000 : 600, // 2000 req/min in dev, 600 req/min in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => extractUserOrIpKey(req),
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: 'User request limit exceeded. Please wait a moment before trying again.',
  },
});

// Per-User rate limiter for manual synchronization triggers
export const syncRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 60 : 20, // 60 in dev, 20 in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => extractUserOrIpKey(req),
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: 'Too many sync trigger requests. Please wait a moment before triggering synchronization again.',
  },
});

// Per-User rate limiter for sending outbound emails
export const sendEmailRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 60 : 20, // 60 in dev, 20 in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => extractUserOrIpKey(req),
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: 'Email sending rate limit exceeded. Please wait a minute before sending more emails.',
  },
});
