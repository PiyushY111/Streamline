import { Router } from 'express';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../controllers/events.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { createEventSchema, updateEventSchema, eventIdParamSchema } from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.get('/', listEvents);
router.post('/', validateBody(createEventSchema), createEvent);
router.patch('/:id', validateParams(eventIdParamSchema), validateBody(updateEventSchema), updateEvent);
router.delete('/:id', validateParams(eventIdParamSchema), deleteEvent);

export default router;
