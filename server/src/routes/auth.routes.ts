import { Router } from 'express';
import { register, login, me, logout } from '../controllers/auth.controller.js';
import { connectGoogle, googleCallback } from '../controllers/oauth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { validateBody } from '../middlewares/validate.js';
import { registerSchema, loginSchema } from '../schemas/index.js';

const router = Router();

// App Auth Routes (Rate Limited)
router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/logout', logout);
router.get('/me', authenticate, me);

// Google OAuth Flow Routes
router.get('/google/connect', authenticate, connectGoogle);
router.get('/google/callback', googleCallback);

export default router;
