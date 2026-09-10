import { Request, Response, NextFunction } from 'express';

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next?: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch((err) => {
      if (typeof next === 'function') {
        next(err);
      } else {
        const status = err?.statusCode || 500;
        res.status(status).json({ error: err?.message || 'Internal Server Error' });
      }
    });
  };
}
