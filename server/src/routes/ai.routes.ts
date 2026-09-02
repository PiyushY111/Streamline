import { Router } from 'express';
import {
  getPreferences,
  updatePreferences,
  getRadarTasks,
  convertRadarTask,
  dismissRadarTask,
  getDailyDigest,
  triggerDigestNow,
  listDailyDigests,
  draftReply,
  summarizeThread,
  triggerAutoLabelAll,
  labelSingleEmail,
  getTokenUsageStats,
} from '../controllers/ai.controller.js';

import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  updateAiPreferencesSchema,
  convertRadarTaskSchema,
  dismissRadarTaskSchema,
  draftReplySchema,
  threadIdParamSchema,
} from '../schemas/index.js';

const router = Router();

// All AI routes require user authentication
router.use(authenticate);

// Auto-Labeling & Triage
router.post('/triage/all', triggerAutoLabelAll);
router.post('/emails/:emailId/triage', labelSingleEmail);

// User AI Preferences & Cost Guard
router.get('/preferences', getPreferences);
router.patch('/preferences', validateBody(updateAiPreferencesSchema), updatePreferences);
router.get('/usage', getTokenUsageStats);


// AI Task Radar
router.get('/tasks/radar', getRadarTasks);
router.post('/tasks/convert', validateBody(convertRadarTaskSchema), convertRadarTask);
router.post('/tasks/dismiss', validateBody(dismissRadarTaskSchema), dismissRadarTask);

// Daily Executive Digest & Newsletters
router.get('/daily-digest/today', getDailyDigest);
router.post('/daily-digest/generate-now', triggerDigestNow);
router.get('/daily-digest/history', listDailyDigests);

// Thread Intelligence & Drafting
router.post('/threads/:threadId/summarize', validateParams(threadIdParamSchema), summarizeThread);
router.post('/threads/draft-reply', validateBody(draftReplySchema), draftReply);

export default router;

