import { Response } from 'express';
import { emailsService } from '../services/emails.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function listEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const folder = (req.query.folder as string) || 'inbox';
    const parsedLimit = parseInt(req.query.limit as string, 10) || 50;
    const limit = Math.min(Math.max(1, parsedLimit), 100);
    const page = parseInt(req.query.page as string, 10) || 1;
    const emailList = await emailsService.getEmails(req.user.id, folder, limit, page);

    res.json({ emails: emailList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list emails';
    logger.error({ err }, 'List emails controller error');
    res.status(500).json({ error: message });
  }
}

export async function getEmailById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const email = await emailsService.getEmailById(id, req.user.id);
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, email });
  } catch (err: unknown) {
    logger.error({ err }, 'Get email by ID controller error');
    res.status(500).json({ error: 'Failed to fetch email details' });
  }
}

export async function sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { to, subject, body, accountId } = req.body;
    const sentEmail = await emailsService.sendEmail(req.user.id, { to, subject, body, accountId });
    res.status(200).json({ success: true, email: sentEmail, message: `Email sent to ${to}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    logger.error({ err }, 'Send email controller error');
    res.status(500).json({ error: message });
  }
}

export async function markEmailAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isRead = true } = req.body;
    const updated = await emailsService.markAsRead(id, req.user.id, isRead);
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update read status' });
  }
}

export async function toggleStarEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isStarred = true } = req.body;
    const updated = await emailsService.toggleStar(id, req.user.id, isStarred);
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update star status' });
  }
}

export async function updateEmailCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { category } = req.body;
    const updated = await emailsService.updateCategory(id, req.user.id, category);
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    logger.error({ err }, 'Update email category controller error');
    res.status(500).json({ error: 'Failed to update email category' });
  }
}

export async function deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await emailsService.deleteEmail(id, req.user.id);
    res.json({ success: true, message: 'Email deleted successfully' });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
}
