import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import apiRouter from './routes/index.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { startSyncScheduler } from './workers/scheduler.js';
import { accountSyncQueue, aiTriageQueue, dailyDigestQueue, redisConnection } from './queues/index.js';
import { securityHeaders } from './middlewares/security.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { requestId } from './middlewares/requestId.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { toError } from './utils/errors.js';

const app = express();

// Request Correlation ID (assigned first so all logs carry it)
app.use(requestId);

// Security Headers
app.use(securityHeaders);

// CORS Whitelist Configuration
const allowedOrigins = [env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  }),
);

// Global Rate Limiting & Parsing (1MB default limit)
app.use(apiRateLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// Request Logger (correlated via req.id)
app.use((req, res, next) => {
  logger.info({ reqId: req.id, method: req.method, url: req.url }, 'Incoming API Request');
  next();
});

// Root Status
app.get('/', (req, res) => {
  res.json({
    name: 'Streamline Backend API',
    status: 'running',
    version: '1.0.0',
    health: '/api/health',
  });
});

// API Routes
app.use('/api', apiRouter);

// 404 Handler for unmatched routes & Global Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  const port = parseInt(env.PORT, 10) || 5001;

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info({ port, env: env.NODE_ENV }, `⚡ Streamline Backend API running on port ${port}`);

    startWorkers();
    startSyncScheduler();
  });

  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown signal received. Releasing resources...');

    // Force terminate after 5 seconds if graceful drain is stuck
    const forceExitTimer = setTimeout(() => {
      logger.error('Forced exit timeout reached (5000ms). Terminating process.');
      process.exit(1);
    }, 5000);
    forceExitTimer.unref();

    server.close(async () => {
      logger.info('HTTP server closed to new connections.');
      try {
        await stopWorkers();
        await Promise.allSettled([accountSyncQueue.close(), aiTriageQueue.close(), dailyDigestQueue.close()]);
        if (redisConnection.status === 'ready' || redisConnection.status === 'connecting') {
          await redisConnection.quit();
          logger.info('Redis connection cleanly terminated.');
        }
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        logger.error({ err: err.message }, 'Error during graceful shutdown');
      } finally {
        clearTimeout(forceExitTimer);
        logger.info('✨ Graceful shutdown completed cleanly. Exiting.');
        process.exit(0);
      }
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during server bootstrap');
  process.exit(1);
});
