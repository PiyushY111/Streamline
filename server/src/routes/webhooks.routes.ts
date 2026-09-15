import { Router } from 'express';
import { handleGmailPushWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// Endpoint called by Google Cloud Pub/Sub push subscription
router.post('/gmail/push', handleGmailPushWebhook);

export default router;
