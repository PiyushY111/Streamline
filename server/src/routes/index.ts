import express, { Router } from 'express';
import { checkHealth } from '../controllers/health.controller.js';
import { register, login, me, logout } from '../controllers/auth.controller.js';
import {
  connectGoogle,
  googleCallback,
  listAccounts,
  updateAccount,
  disconnectAccount,
} from '../controllers/oauth.controller.js';
import {
  listEmails,
  sendEmail,
  markEmailAsRead,
  deleteEmail,
  toggleStarEmail,
} from '../controllers/emails.controller.js';
import { listEvents, createEvent, updateEvent, deleteEvent, listCalendars } from '../controllers/events.controller.js';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller.js';
import { triggerManualSync } from '../controllers/sync.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Health Check
router.get('/health', checkHealth);

// App Auth Routes (Rate Limited)
router.post('/auth/register', authRateLimiter, register);
router.post('/auth/login', authRateLimiter, login);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticate, me);

// Google OAuth Flow Routes
router.get('/auth/google/connect', connectGoogle);
router.get('/auth/google/callback', googleCallback);

// Connected Accounts CRUD Routes
router.get('/accounts', listAccounts);
router.patch('/accounts/:id', updateAccount);
router.delete('/accounts/:id', disconnectAccount);

// Sync Engine Trigger Route
router.post('/sync/trigger', triggerManualSync);

// Email Routes (Scoped 50MB parser for attachment handling)
router.get('/emails', listEmails);
router.post('/emails/send', express.json({ limit: '50mb' }), sendEmail);
router.patch('/emails/:id/read', markEmailAsRead);
router.patch('/emails/:id/star', toggleStarEmail);
router.delete('/emails/:id', deleteEmail);

// Agenda / Calendar Routes
router.get('/events', listEvents);
router.post('/events', createEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);
router.get('/agenda', listEvents);
router.get('/calendars', listCalendars);

// Tasks Routes
router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

export default router;
