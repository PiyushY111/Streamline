import { Router } from 'express';
import { listEvents, listCalendars } from '../controllers/events.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { csrfProtection } from '../middlewares/security.js';

import authRouter from './auth.routes.js';
import webhooksRouter from './webhooks.routes.js';
import liveRouter from './live.routes.js';
import accountsRouter from './accounts.routes.js';
import syncRouter from './sync.routes.js';
import emailsRouter from './emails.routes.js';
import eventsRouter from './events.routes.js';
import tasksRouter from './tasks.routes.js';
import projectsRouter from './projects.routes.js';
import plannerRouter from './planner.routes.js';
import aiRouter from './ai.routes.js';
import agentRouter from './agent.routes.js';
import graphRouter from './graph.routes.js';
import healthRouter from './health.routes.js';

const router = Router();

// Health Check (unauthenticated, un-rate-limited: /, /liveness, /readiness)
router.use('/health', healthRouter);

// Authentication & OAuth Flow Routes
router.use('/auth', authRouter);

// Webhook Endpoints (unauthenticated, signature/token verified by provider payload)
router.use('/webhooks', webhooksRouter);

// Apply CSRF Protection to all downstream state-changing API endpoints
router.use(csrfProtection);

// Live Real-Time Server-Sent Events (SSE) Stream
router.use('/live', liveRouter);

// Core Resource & Domain Sub-Routers
router.use('/accounts', accountsRouter);
router.use('/sync', syncRouter);
router.use('/emails', emailsRouter);
router.use('/events', eventsRouter);
router.use('/tasks', tasksRouter);
router.use('/projects', projectsRouter);
router.use('/planner', plannerRouter);
router.use('/ai', aiRouter);
router.use('/agent', agentRouter);
router.use('/graph', graphRouter);

// Calendar / Agenda Convenience Aliases
router.get('/agenda', authenticate, listEvents);
router.get('/calendars', authenticate, listCalendars);

export default router;
