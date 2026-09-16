import { Router } from 'express';
import { listAccounts, updateAccount, disconnectAccount } from '../controllers/oauth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { accountIdParamSchema, updateAccountSchema } from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.get('/', listAccounts);
router.patch('/:id', validateParams(accountIdParamSchema), validateBody(updateAccountSchema), updateAccount);
router.delete('/:id', validateParams(accountIdParamSchema), disconnectAccount);

export default router;
