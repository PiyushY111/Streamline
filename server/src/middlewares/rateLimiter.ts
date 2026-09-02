import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from './auth.js';

// Rate limiter for authentication routes (login, register)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please slow down.',
  },
});

// Per-User rate limiter for manual synchronization triggers
export const syncRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each user/IP to 5 manual sync triggers per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || req.ip || 'anonymous',
  message: {
    error: 'Too many sync trigger requests. Please wait a minute before triggering synchronization again.',
  },
});

// Per-User rate limiter for sending outbound emails
export const sendEmailRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit each user to 15 emails sent per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || req.ip || 'anonymous',
  message: {
    error: 'Email sending rate limit exceeded. Please wait a minute before sending more emails.',
  },
});
