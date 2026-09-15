import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { sseService } from '../services/sse.service.js';
import { UnauthorizedError } from '../errors/index.js';

export const streamLiveEvents = (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Authentication required to connect to live event stream');
  }

  sseService.addClient(userId, res);
};
