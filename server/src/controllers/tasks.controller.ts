import { Response } from 'express';
import { tasksService } from '../services/tasks.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const taskList = await tasksService.getTasks(req.user.id);
    res.json({ tasks: taskList });
  } catch (err: unknown) {
    logger.error({ err }, 'List tasks controller error');
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const newTask = await tasksService.createTask(req.user.id, req.body);
    res.status(201).json({ task: newTask });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await tasksService.updateTask(id, req.user.id, req.body);
    res.json({ task: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update task' });
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await tasksService.deleteTask(id, req.user.id);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
}
