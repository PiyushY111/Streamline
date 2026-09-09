import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { projectsRepository } from '../repositories/projects.repository.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { logger } from '../utils/logger.js';

export async function listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const projectsList = await projectsRepository.listUserProjects(req.user.id);
    res.json({ projects: projectsList });
  } catch (err: unknown) {
    logger.error({ err }, 'List projects controller error');
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

export async function getProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectsRepository.getById(id, req.user.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (err: unknown) {
    logger.error({ err }, 'Get project controller error');
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { name, description, status, color, stack, currentMilestone } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Project name is required' });
      return;
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
  } catch (err: unknown) {
    logger.error({ err }, 'Create project controller error');
    res.status(500).json({ error: 'Failed to create project' });
  }
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await projectsRepository.update(id, req.user.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project: updated });
  } catch (err: unknown) {
    logger.error({ err }, 'Update project controller error');
    res.status(500).json({ error: 'Failed to update project' });
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await projectsRepository.delete(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ success: true, project: deleted });
  } catch (err: unknown) {
    logger.error({ err }, 'Delete project controller error');
    res.status(500).json({ error: 'Failed to delete project' });
  }
}

export async function getProjectTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const taskList = await tasksRepository.listByProject(req.user.id, id);
    res.json({ tasks: taskList });
  } catch (err: unknown) {
    logger.error({ err }, 'Get project tasks controller error');
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
}
