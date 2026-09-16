import { Response } from 'express';
import { eventsService } from '../services/events.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { UnauthorizedError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

export const listEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const eventList = await eventsService.getEvents(req.user.id, startDate, endDate);
  res.json({ events: eventList });
});

export const listCalendars = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const calendarList = await eventsService.getCalendars(req.user.id);
  res.json({ calendars: calendarList });
});

export const createEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const newEvent = await eventsService.createEvent(req.user.id, req.body);
  res.status(201).json({ event: newEvent });
});

export const updateEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  const updated = await eventsService.updateEvent(id, req.user.id, req.body);
  if (!updated) {
    throw new NotFoundError('Event not found or unauthorized');
  }
  res.json({ event: updated });
});

export const deleteEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const id = String(req.params.id || '');
  await eventsService.deleteEvent(id, req.user.id);
  res.json({ success: true });
});
