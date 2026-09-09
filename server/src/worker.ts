import { startWorkers } from './workers/index.js';
import { startSyncScheduler } from './workers/scheduler.js';
import { logger } from './utils/logger.js';
import { redisConnection } from './queues/index.js';

logger.info('🚀 Starting standalone Streamline BullMQ Background Worker process...');

try {
  startWorkers();
  startSyncScheduler();
  logger.info('✨ Standalone Background Workers and Schedulers running successfully.');
} catch (err: any) {
  logger.error({ err: err.message, stack: err.stack }, 'Fatal error starting background workers');
  process.exit(1);
}

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal. Gracefully stopping workers...');
  try {
    await redisConnection.quit();
    logger.info('Closed Redis connection. Worker process exiting.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
