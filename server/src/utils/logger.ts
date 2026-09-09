import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: 'info',
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
