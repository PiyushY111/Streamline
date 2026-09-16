import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectTasks,
} from '../controllers/projects.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { createProjectSchema, updateProjectSchema, projectIdParamSchema } from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.get('/', listProjects);
router.post('/', validateBody(createProjectSchema), createProject);
router.get('/:id', validateParams(projectIdParamSchema), getProject);
router.patch('/:id', validateParams(projectIdParamSchema), validateBody(updateProjectSchema), updateProject);
router.delete('/:id', validateParams(projectIdParamSchema), deleteProject);
router.get('/:id/tasks', validateParams(projectIdParamSchema), getProjectTasks);

export default router;
