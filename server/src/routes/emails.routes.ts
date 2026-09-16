import express, { Router } from 'express';
import {
  listEmails,
  getEmailById,
  sendEmail,
  markEmailAsRead,
  deleteEmail,
  toggleStarEmail,
  updateEmailCategory,
} from '../controllers/emails.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { sendEmailRateLimiter } from '../middlewares/rateLimiter.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  emailIdParamSchema,
  sendEmailSchema,
  markEmailReadSchema,
  starEmailSchema,
  updateCategorySchema,
} from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.get('/', listEmails);
router.get('/:id', validateParams(emailIdParamSchema), getEmailById);
router.post('/send', sendEmailRateLimiter, express.json({ limit: '50mb' }), validateBody(sendEmailSchema), sendEmail);
router.patch('/:id/read', validateParams(emailIdParamSchema), validateBody(markEmailReadSchema), markEmailAsRead);
router.patch('/:id/star', validateParams(emailIdParamSchema), validateBody(starEmailSchema), toggleStarEmail);
router.patch(
  '/:id/category',
  validateParams(emailIdParamSchema),
  validateBody(updateCategorySchema),
  updateEmailCategory,
);
router.delete('/:id', validateParams(emailIdParamSchema), deleteEmail);

export default router;
