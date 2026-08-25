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
router.get('/auth/google/connect', authenticate, connectGoogle);
router.get('/auth/google/callback', googleCallback);

// Connected Accounts CRUD Routes
router.get('/accounts', authenticate, listAccounts);
router.patch('/accounts/:id', authenticate, updateAccount);
router.delete('/accounts/:id', authenticate, disconnectAccount);

// Sync Engine Trigger Route
router.post('/sync/trigger', authenticate, triggerManualSync);

// Email Routes
router.get('/emails', authenticate, listEmails);
router.post('/emails/send', authenticate, express.json({ limit: '50mb' }), sendEmail);
router.patch('/emails/:id/read', authenticate, markEmailAsRead);
router.patch('/emails/:id/star', authenticate, toggleStarEmail);
router.delete('/emails/:id', authenticate, deleteEmail);

// Agenda / Calendar Routes
router.get('/events', authenticate, listEvents);
router.post('/events', authenticate, createEvent);
router.patch('/events/:id', authenticate, updateEvent);
router.delete('/events/:id', authenticate, deleteEvent);
router.get('/agenda', authenticate, listEvents);
router.get('/calendars', authenticate, listCalendars);

// Tasks Routes
router.get('/tasks', authenticate, listTasks);
router.post('/tasks', authenticate, createTask);
router.patch('/tasks/:id', authenticate, updateTask);
router.delete('/tasks/:id', authenticate, deleteTask);

export default router;
