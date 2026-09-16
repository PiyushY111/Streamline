import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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

// IP Tier (Unauthenticated traffic protection - 60 req/min)
export const ipTierLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded for IP. Please slow down.',
  },
});

// Alias for general API IP-level limiter
export const apiRateLimiter = ipTierLimiter;

// Authenticated User Tier (120 req/min per user)
export const userTierLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Limit each authenticated user to 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: 'User request limit exceeded. Maximum 120 requests per minute.',
  },
});

// Per-User rate limiter for manual synchronization triggers
export const syncRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each user/IP to 5 manual sync triggers per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
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
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: 'Email sending rate limit exceeded. Please wait a minute before sending more emails.',
  },
});
