import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { plannerService } from '../services/planner.service.js';
import { UnauthorizedError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const getNextTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }

  const { preset, availableMinutes, projectId } = req.query;

  const result = await plannerService.getNextTask(req.user.id, {
    preset: preset as any,
    availableMinutes: availableMinutes ? Number(availableMinutes) : undefined,
    projectId: projectId ? String(projectId) : undefined,
  });

  res.json(result);
});

export const rankTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }

  const { preset, weights, availableMinutes } = req.body;

  const ranked = await plannerService.rankTasks(req.user.id, {
    preset,
    weights,
    availableMinutes: availableMinutes ? Number(availableMinutes) : undefined,
  });

  res.json({ tasks: ranked });
});

export const getWeightPresets = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const presets = plannerService.getWeightPresets();
  res.json({ presets });
});
