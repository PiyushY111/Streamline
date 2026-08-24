import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info({ mode: env.NODE_ENV }, 'Starting Streamline Worker Service...');

  // Placeholder setup for BullMQ workers and sync listeners
  logger.info('Streamline Worker Service scaffold initialized successfully.');

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down worker gracefully...');
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during worker bootstrap');
  process.exit(1);
});
