import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { requestContext } from '../utils/context.js';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  const id = incomingId || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);

  requestContext.run(
    {
      requestId: id,
      source: 'http_request',
    },
    () => {
      next();
    },
  );
}
