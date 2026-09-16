import { db } from '../db/index.js';
import { auditLogs } from '../db/schema/index.js';
import { logger } from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AuditService {
  /**
   * Records an immutable audit log entry in the database.
   * Accepts an optional database or transaction client.
   */
  async logAction(userId: string, action: string, meta?: Record<string, any>, executor: any = db): Promise<void> {
    if (!userId || !UUID_REGEX.test(userId)) {
      logger.debug({ userId, action }, 'Audit log skipped: userId is not a valid UUID');
      return;
    }

    try {
      await executor.insert(auditLogs).values({
        userId,
        action,
        meta: meta || {},
      });
      logger.info({ userId, action }, '🔒 Audit log recorded');
    } catch (err) {
      logger.error({ err, userId, action }, 'Failed to record audit log');
    }
  }
}

export const auditService = new AuditService();
