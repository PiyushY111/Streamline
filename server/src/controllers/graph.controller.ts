import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { graphRAGService } from '../services/ai/memory/graph-rag.service.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { UnauthorizedError, BadRequestError } from '../errors/index.js';

export const getUserGraph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Authentication required');

  const graphData = await graphRAGService.getUserGraphData(userId);
  res.json({ success: true, ...graphData });
});

export const queryGraphRAG = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Authentication required');

  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new BadRequestError('Search query string is required');
  }

  const result = await graphRAGService.queryGraphRAG(userId, query.trim());
  res.json({ success: true, ...result });
});
