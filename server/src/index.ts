import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import apiRouter from './routes/index.js';
import { startWorkers } from './workers/index.js';
import { startSyncScheduler } from './workers/scheduler.js';
import { securityHeaders } from './middlewares/security.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';

const app = express();

// Security Headers
app.use(securityHeaders);

// CORS Whitelist Configuration
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
}));

// Global Rate Limiting & Parsing (1MB default limit)
app.use(apiRateLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// Request Logger
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming API Request');
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root Status
app.get('/', (req, res) => {
  res.json({
    name: 'Streamline Backend API',
    status: 'running',
    version: '1.0.0',
    health: '/api/health',
  });
});

async function bootstrap() {
  const port = parseInt(env.PORT, 10) || 5001;

  const server = app.listen(port, () => {
    logger.info({ port, env: env.NODE_ENV }, `⚡ Streamline Backend API running on port ${port}`);

    startWorkers();
    startSyncScheduler();
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during server bootstrap');
  process.exit(1);
});
