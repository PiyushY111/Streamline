import { Router } from 'express';
import {
  getNextTask,
  rankTasks,
  getWeightPresets,
} from '../controllers/planner.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/next', getNextTask);
router.post('/rank', rankTasks);
router.get('/presets', getWeightPresets);

export default router;
