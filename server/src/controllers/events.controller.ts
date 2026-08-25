import { Response } from 'express';
import { eventsService } from '../services/events.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function listEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'demo-user';
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const eventList = await eventsService.getEvents(userId, startDate, endDate);
    res.json({ events: eventList });
  } catch (err: unknown) {
    logger.error({ err }, 'List events controller error');
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

export async function listCalendars(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id || 'demo-user';
    const calendarList = await eventsService.getCalendars(userId);
    res.json({ calendars: calendarList });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
}

export async function createEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const newEvent = await eventsService.createEvent(req.body);
    res.status(201).json({ event: newEvent });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to create event' });
  }
}

export async function updateEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await eventsService.updateEvent(id, req.body);
    res.json({ event: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to update event' });
  }
}

export async function deleteEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await eventsService.deleteEvent(id);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
}
