import { Response } from 'express';
import { emailsService } from '../services/emails.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function listEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'demo-user';
    const folder = (req.query.folder as string) || 'inbox';
    const emailList = await emailsService.getEmails(userId, folder);
    res.json({ emails: emailList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list emails';
    logger.error({ err }, 'List emails controller error');
    res.status(500).json({ error: message });
  }
}

export async function sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { to } = req.body;
    res.status(200).json({ success: true, message: `Email queued for sending to ${to}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    res.status(500).json({ error: message });
  }
}

export async function markEmailAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isRead = true } = req.body;
    const updated = await emailsService.markAsRead(id, isRead);
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update read status' });
  }
}

export async function toggleStarEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isStarred = true } = req.body;
    const updated = await emailsService.toggleStar(id, isStarred);
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update star status' });
  }
}

export async function deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await emailsService.deleteEmail(id);
    res.json({ success: true, message: 'Email deleted successfully' });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
}
