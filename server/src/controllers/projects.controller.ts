import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { projectsRepository } from '../repositories/projects.repository.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const listProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const projectsList = await projectsRepository.listUserProjects(req.user.id);
  res.json({ projects: projectsList });
});

export const getProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const project = await projectsRepository.getById(id, req.user.id);
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  res.json({ project });
});

export const createProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const { name, description, status, color, stack, currentMilestone } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new BadRequestError('Project name is required');
  }

  const newProject = await projectsRepository.create({
    userId: req.user.id,
    name: name.trim(),
    description,
    status,
    color,
    stack,
    currentMilestone,
  });
  res.status(201).json({ project: newProject });
});

export const updateProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updated = await projectsRepository.update(id, req.user.id, req.body);
  if (!updated) {
    throw new NotFoundError('Project not found');
  }
  res.json({ project: updated });
});

export const deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await projectsRepository.delete(id, req.user.id);
  if (!deleted) {
    throw new NotFoundError('Project not found');
  }
  res.json({ success: true, project: deleted });
});

export const getProjectTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const taskList = await tasksRepository.listByProject(req.user.id, id);
  res.json({ tasks: taskList });
});
