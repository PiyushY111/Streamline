import { db } from '../db/index.js';
import { auditLogs } from '../db/schema/index.js';
import { logger } from '../utils/logger.js';

export class AuditService {
  /**
   * Records an immutable audit log entry in the database.
   */
  async logAction(userId: string, action: string, meta?: Record<string, any>): Promise<void> {
    try {
      await db.insert(auditLogs).values({
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
