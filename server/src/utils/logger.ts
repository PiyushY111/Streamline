import pino from 'pino';
import { env } from '../config/env.js';
import { requestContext } from './context.js';

export const logger = pino({
  level: (process.env.LOG_LEVEL as string) || 'info',
  mixin() {
    const store = requestContext.getStore();
    if (!store) return {};
    return {
      reqId: store.requestId,
      ...(store.userId ? { userId: store.userId } : {}),
      ...(store.sessionId ? { sessionId: store.sessionId } : {}),
      ...(store.traceId ? { traceId: store.traceId } : {}),
    };
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.cookies.session_token',
      'req.cookies.csrf_token',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.clientSecret',
      '*.encryptionKey',
      '*.geminiApiKey',
      'body.password',
      'body.token',
      'body.accessToken',
      'body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
