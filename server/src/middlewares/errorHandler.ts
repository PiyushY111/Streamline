import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error | AppError | ZodError | unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return _next(err);
  }

  const reqId = req.id || 'unknown';

  // 1. Handled AppError (Operational)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ reqId, err, path: req.path, method: req.method }, 'Server Error');
    } else {
      logger.warn({ reqId, err: err.message, code: err.code, path: req.path }, 'Client Error');
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      requestId: reqId,
    });
    return;
  }

  // 2. Zod Schema Validation Error
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn({ reqId, details, path: req.path }, 'Validation Error');

    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
      requestId: reqId,
    });
    return;
  }

  // 3. Malformed JSON Body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'Malformed JSON payload',
      code: 'BAD_REQUEST',
      requestId: reqId,
    });
    return;
  }

  // 4. Unhandled Internal Server Errors
  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error(
    { reqId, err: errorObj.message, stack: errorObj.stack, path: req.path, method: req.method },
    'Unhandled Exception',
  );

  const isProd = env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProd ? 'Internal Server Error' : errorObj.message,
    code: 'INTERNAL_SERVER_ERROR',
    requestId: reqId,
    ...(isProd ? {} : { stack: errorObj.stack }),
  });
}
