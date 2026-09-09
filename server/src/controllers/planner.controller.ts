import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { plannerService } from '../services/planner.service.js';
import { logger } from '../utils/logger.js';

export async function getNextTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { preset, availableMinutes, projectId } = req.query;

    const result = await plannerService.getNextTask(req.user.id, {
      preset: preset as any,
      availableMinutes: availableMinutes ? Number(availableMinutes) : undefined,
      projectId: projectId ? String(projectId) : undefined,
    });

    res.json(result);
  } catch (err: unknown) {
    logger.error({ err }, 'Get next task controller error');
    res.status(500).json({ error: 'Failed to compute next task' });
  }
}

export async function rankTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { preset, weights, availableMinutes } = req.body;

    const ranked = await plannerService.rankTasks(req.user.id, {
      preset,
      weights,
      availableMinutes: availableMinutes ? Number(availableMinutes) : undefined,
    });

    res.json({ tasks: ranked });
  } catch (err: unknown) {
    logger.error({ err }, 'Rank tasks controller error');
    res.status(500).json({ error: 'Failed to rank tasks' });
  }
}

export async function getWeightPresets(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const presets = plannerService.getWeightPresets();
    res.json({ presets });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
}
