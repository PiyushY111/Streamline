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

// Projects Routes (Stage 1)
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectTasks,
} from '../controllers/projects.controller.js';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
} from '../schemas/index.js';

router.get('/projects', authenticate, listProjects);
router.post('/projects', authenticate, validateBody(createProjectSchema), createProject);
router.get(
  '/projects/:id',
  authenticate,
  validateParams(projectIdParamSchema),
  getProject
);
router.patch(
  '/projects/:id',
  authenticate,
  validateParams(projectIdParamSchema),
  validateBody(updateProjectSchema),
  updateProject
);
router.delete(
  '/projects/:id',
  authenticate,
  validateParams(projectIdParamSchema),
  deleteProject
);
router.get(
  '/projects/:id/tasks',
  authenticate,
  validateParams(projectIdParamSchema),
  getProjectTasks
);

// Deterministic Planner Routes (Stage 1)
import {
  getNextTask,
  rankTasks,
  getWeightPresets,
} from '../controllers/planner.controller.js';

router.get('/planner/next', authenticate, getNextTask);
router.post('/planner/rank', authenticate, rankTasks);
router.get('/planner/presets', authenticate, getWeightPresets);

// AI Engine Routes
import aiRouter from './ai.routes.js';
router.use('/ai', aiRouter);

// Agent Assistant & Human-in-the-Loop Routes (Stage 2)
import {
  chat,
  chatStream,
  listPendingActions,
  approveAction,
  rejectAction,
  listSessions,
  getSessionMessages,
  listUserMemories,
  createUserMemory,
  searchUserMemories,
  deleteUserMemory,
  getProviderInfo,
  getSecurityStatus,
  simulateInjection,
  getTrace,
  getAgentStats,
  streamTrace,
} from '../controllers/agent.controller.js';
import {
  agentChatSchema,
  pendingActionIdParamSchema,
  sessionIdParamSchema,
  memoryIdParamSchema,
} from '../schemas/index.js';

router.post('/agent/chat', authenticate, validateBody(agentChatSchema), chat);
router.post('/agent/chat/stream', authenticate, validateBody(agentChatSchema), chatStream);
router.get('/agent/actions/pending', authenticate, listPendingActions);
router.post(
  '/agent/actions/:id/approve',
  authenticate,
  validateParams(pendingActionIdParamSchema),
  approveAction
);
router.post(
  '/agent/actions/:id/reject',
  authenticate,
  validateParams(pendingActionIdParamSchema),
  rejectAction
);
router.get('/agent/sessions', authenticate, listSessions);
router.get(
  '/agent/sessions/:id/messages',
  authenticate,
  validateParams(sessionIdParamSchema),
  getSessionMessages
);

// Semantic Memory & RAG Routes (Stage 3)
router.get('/agent/memories', authenticate, listUserMemories);
router.post('/agent/memories', authenticate, createUserMemory);
router.get('/agent/memories/search', authenticate, searchUserMemories);
router.delete(
  '/agent/memories/:id',
  authenticate,
  validateParams(memoryIdParamSchema),
  deleteUserMemory
);
router.get('/agent/provider', authenticate, getProviderInfo);

// Prompt-Injection Defense & Security Routes (Stage 4)
router.get('/agent/security/status', authenticate, getSecurityStatus);
router.post('/agent/security/simulate-injection', authenticate, simulateInjection);

// Observability & OpenTelemetry Decision Trace Routes (Stage 5)
router.get(
  '/agent/traces/:sessionId',
  authenticate,
  validateParams(sessionIdParamSchema),
  getTrace
);
router.get(
  '/agent/traces/:sessionId/stream',
  authenticate,
  validateParams(sessionIdParamSchema),
  streamTrace
);
router.get('/agent/stats', authenticate, getAgentStats);

export default router;



