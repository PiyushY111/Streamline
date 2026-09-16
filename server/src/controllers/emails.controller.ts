import { Response } from 'express';
import { emailsService } from '../services/emails.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { UnauthorizedError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const listEmails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const folder = (req.query.folder as string) || 'inbox';
  const parsedLimit = parseInt(req.query.limit as string, 10) || 50;
  const limit = Math.min(Math.max(1, parsedLimit), 100);
  const page = parseInt(req.query.page as string, 10) || 1;
  const emailList = await emailsService.getEmails(req.user.id, folder, limit, page);

  res.json({ emails: emailList });
});

export const getEmailById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  const email = await emailsService.getEmailById(id, req.user.id);
  if (!email) {
    throw new NotFoundError('Email not found');
  }
  res.json({ success: true, email });
});

export const sendEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const { to, subject, body, accountId } = req.body;
  const sentEmail = await emailsService.sendEmail(req.user.id, { to, subject, body, accountId });
  res.status(200).json({ success: true, email: sentEmail, message: `Email sent to ${to}` });
});

export const markEmailAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  const { isRead = true } = req.body;
  const updated = await emailsService.markAsRead(id, req.user.id, isRead);
  if (!updated) {
    throw new NotFoundError('Email not found');
  }
  res.json({ success: true, email: updated });
});

export const toggleStarEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  const { isStarred = true } = req.body;
  const updated = await emailsService.toggleStar(id, req.user.id, isStarred);
  if (!updated) {
    throw new NotFoundError('Email not found');
  }
  res.json({ success: true, email: updated });
});

export const updateEmailCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  const { category } = req.body;
  const updated = await emailsService.updateCategory(id, req.user.id, category);
  if (!updated) {
    throw new NotFoundError('Email not found');
  }
  res.json({ success: true, email: updated });
});

export const deleteEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  await emailsService.deleteEmail(id, req.user.id);
  res.json({ success: true, message: 'Email deleted successfully' });
});
