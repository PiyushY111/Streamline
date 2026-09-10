import { Response } from 'express';
import { tasksService } from '../services/tasks.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { UnauthorizedError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const listTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const taskList = await tasksService.getTasks(req.user.id);
  res.json({ tasks: taskList });
});

export const createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const newTask = await tasksService.createTask(req.user.id, req.body);
  res.status(201).json({ task: newTask });
});

export const updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updated = await tasksService.updateTask(id, req.user.id, req.body);
  res.json({ task: updated });
});

export const deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await tasksService.deleteTask(id, req.user.id);
  res.json({ success: true });
});
