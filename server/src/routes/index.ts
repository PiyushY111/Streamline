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
  getEmailById,
  sendEmail,
  markEmailAsRead,
  deleteEmail,
  toggleStarEmail,
  updateEmailCategory,
} from '../controllers/emails.controller.js';
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listCalendars,
} from '../controllers/events.controller.js';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller.js';
import { triggerManualSync } from '../controllers/sync.controller.js';
import { authenticate } from '../middlewares/auth.js';
import {
  authRateLimiter,
  syncRateLimiter,
  sendEmailRateLimiter,
} from '../middlewares/rateLimiter.js';
import { csrfProtection } from '../middlewares/security.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  registerSchema,
  loginSchema,
  updateAccountSchema,
  accountIdParamSchema,
  sendEmailSchema,
  emailIdParamSchema,
  markEmailReadSchema,
  starEmailSchema,
  updateCategorySchema,
  createEventSchema,
  updateEventSchema,
  eventIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
} from '../schemas/index.js';

const router = Router();

// Health Check
router.get('/health', checkHealth);

// App Auth Routes (Rate Limited)
router.post('/auth/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/auth/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticate, me);

// Google OAuth Flow Routes
router.get('/auth/google/connect', authenticate, connectGoogle);
router.get('/auth/google/callback', googleCallback);

// Apply CSRF Protection to state-changing API endpoints
router.use(csrfProtection);

// Connected Accounts CRUD Routes
router.get('/accounts', authenticate, listAccounts);
router.patch(
  '/accounts/:id',
  authenticate,
  validateParams(accountIdParamSchema),
  validateBody(updateAccountSchema),
  updateAccount
);
router.delete(
  '/accounts/:id',
  authenticate,
  validateParams(accountIdParamSchema),
  disconnectAccount
);

// Sync Engine Trigger Route (Per-User Rate Limited)
router.post('/sync/trigger', authenticate, syncRateLimiter, triggerManualSync);

// Email Routes
router.get('/emails', authenticate, listEmails);
router.get('/emails/:id', authenticate, validateParams(emailIdParamSchema), getEmailById);
router.post(
  '/emails/send',
  authenticate,
  sendEmailRateLimiter,
  express.json({ limit: '50mb' }),
  validateBody(sendEmailSchema),
  sendEmail
);
router.patch(
  '/emails/:id/read',
  authenticate,
  validateParams(emailIdParamSchema),
  validateBody(markEmailReadSchema),
  markEmailAsRead
);
router.patch(
  '/emails/:id/star',
  authenticate,
  validateParams(emailIdParamSchema),
  validateBody(starEmailSchema),
  toggleStarEmail
);
router.patch(
  '/emails/:id/category',
  authenticate,
  validateParams(emailIdParamSchema),
  validateBody(updateCategorySchema),
  updateEmailCategory
);
router.delete(
  '/emails/:id',
  authenticate,
  validateParams(emailIdParamSchema),
  deleteEmail
);

// Agenda / Calendar Routes
router.get('/events', authenticate, listEvents);
router.post('/events', authenticate, validateBody(createEventSchema), createEvent);
router.patch(
  '/events/:id',
  authenticate,
  validateParams(eventIdParamSchema),
  validateBody(updateEventSchema),
  updateEvent
);
router.delete('/events/:id', authenticate, validateParams(eventIdParamSchema), deleteEvent);
router.get('/agenda', authenticate, listEvents);
router.get('/calendars', authenticate, listCalendars);

// Tasks Routes
router.get('/tasks', authenticate, listTasks);
router.post('/tasks', authenticate, validateBody(createTaskSchema), createTask);
router.patch(
  '/tasks/:id',
  authenticate,
  validateParams(taskIdParamSchema),
  validateBody(updateTaskSchema),
  updateTask
);
router.delete('/tasks/:id', authenticate, validateParams(taskIdParamSchema), deleteTask);

export default router;
