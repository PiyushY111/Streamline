import { Router } from 'express';
import { checkHealth, checkLiveness, checkReadiness } from '../controllers/health.controller.js';

const router = Router();

router.get('/', checkHealth);
router.get('/liveness', checkLiveness);
router.get('/readiness', checkReadiness);

export default router;
