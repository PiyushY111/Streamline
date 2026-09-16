import { Router } from 'express';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { createTaskSchema, updateTaskSchema, taskIdParamSchema } from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.get('/', listTasks);
router.post('/', validateBody(createTaskSchema), createTask);
router.patch('/:id', validateParams(taskIdParamSchema), validateBody(updateTaskSchema), updateTask);
router.delete('/:id', validateParams(taskIdParamSchema), deleteTask);

export default router;
