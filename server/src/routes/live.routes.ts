import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { streamLiveEvents } from '../controllers/sse.controller.js';

const router = Router();

// GET /api/live/stream — Server-Sent Events stream for authenticated client
router.get('/stream', authenticate, streamLiveEvents);

export default router;
