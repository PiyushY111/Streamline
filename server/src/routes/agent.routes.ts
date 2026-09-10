import { Router } from 'express';
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
import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  agentChatSchema,
  pendingActionIdParamSchema,
  sessionIdParamSchema,
  memoryIdParamSchema,
} from '../schemas/index.js';

const router = Router();

router.use(authenticate);

// Agent Assistant & Human-in-the-Loop Routes (Stage 2)
router.post('/chat', validateBody(agentChatSchema), chat);
router.post('/chat/stream', validateBody(agentChatSchema), chatStream);
router.get('/actions/pending', listPendingActions);
router.post('/actions/:id/approve', validateParams(pendingActionIdParamSchema), approveAction);
router.post('/actions/:id/reject', validateParams(pendingActionIdParamSchema), rejectAction);
router.get('/sessions', listSessions);
router.get('/sessions/:id/messages', validateParams(sessionIdParamSchema), getSessionMessages);

// Semantic Memory & RAG Routes (Stage 3)
router.get('/memories', listUserMemories);
router.post('/memories', createUserMemory);
router.get('/memories/search', searchUserMemories);
router.delete('/memories/:id', validateParams(memoryIdParamSchema), deleteUserMemory);
router.get('/provider', getProviderInfo);

// Prompt-Injection Defense & Security Routes (Stage 4)
router.get('/security/status', getSecurityStatus);
router.post('/security/simulate-injection', simulateInjection);

// Observability & OpenTelemetry Decision Trace Routes (Stage 5)
router.get('/traces/:sessionId', validateParams(sessionIdParamSchema), getTrace);
router.get('/traces/:sessionId/stream', validateParams(sessionIdParamSchema), streamTrace);
router.get('/stats', getAgentStats);

export default router;
