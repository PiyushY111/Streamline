import { Router } from 'express';
import { triggerManualSync } from '../controllers/sync.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { syncRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.use(authenticate);

router.post('/trigger', syncRateLimiter, triggerManualSync);

export default router;
