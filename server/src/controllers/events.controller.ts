import { Request, Response } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { events, calendars, connectedAccounts } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export interface EventWithConflict {
  id: string;
  calendarId: string;
  accountId: string;
  accountName?: string;
  accountColor?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  hasConflict: boolean;
  conflictingWith: string[];
}

export async function listEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawEvents = await db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        accountId: events.accountId,
        accountName: connectedAccounts.label,
        accountColor: connectedAccounts.color,
        title: events.title,
        description: events.description,
        location: events.location,
        startTime: events.startTime,
        endTime: events.endTime,
      })
      .from(events)
      .leftJoin(connectedAccounts, eq(events.accountId, connectedAccounts.id))
      .orderBy(asc(events.startTime));

    // Sweep-line overlap check: detect double-booking conflicts across calendars
    const sorted = [...rawEvents].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const conflictsMap: Record<string, string[]> = {};

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const eventA = sorted[i];
        const eventB = sorted[j];

        const startA = new Date(eventA.startTime).getTime();
        const endA = new Date(eventA.endTime).getTime();
        const startB = new Date(eventB.startTime).getTime();

        if (startB < endA) {
          if (!conflictsMap[eventA.id]) conflictsMap[eventA.id] = [];
          if (!conflictsMap[eventB.id]) conflictsMap[eventB.id] = [];
          conflictsMap[eventA.id].push(eventB.id);
          conflictsMap[eventB.id].push(eventA.id);
        } else {
          break;
        }
      }
    }

    const processedEvents: EventWithConflict[] = rawEvents.map((evt) => ({
      ...evt,
      accountName: evt.accountName || 'Calendar',
      accountColor: evt.accountColor || '#4285F4',
      hasConflict: Boolean(conflictsMap[evt.id] && conflictsMap[evt.id].length > 0),
      conflictingWith: conflictsMap[evt.id] || [],
    }));

    res.json({ events: processedEvents });
  } catch (err: any) {
    logger.error({ err }, 'Error listing agenda events from database');
    res.status(500).json({ error: 'Failed to fetch agenda events' });
  }
}

export async function createEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, description, location, startTime, endTime, accountId, calendarId } = req.body;

    // Find account or default
    const [acc] = accountId
      ? await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, accountId))
      : await db.select().from(connectedAccounts).limit(1);

    const targetAccountId = acc?.id || '00000000-0000-0000-0000-000000000001';

    // Find calendar or default
    const [cal] = calendarId
      ? await db.select().from(calendars).where(eq(calendars.id, calendarId))
      : await db.select().from(calendars).limit(1);

    const targetCalendarId = cal?.id || '00000000-0000-0000-0000-000000000002';

    const [newEvent] = await db
      .insert(events)
      .values({
        accountId: targetAccountId,
        calendarId: targetCalendarId,
        externalEventId: `evt_${Date.now()}`,
        title: title || 'New Event',
        description: description || null,
        location: location || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      })
      .returning();

    res.status(201).json({
      event: {
        ...newEvent,
        accountName: acc?.label || 'Calendar',
        accountColor: acc?.color || '#4285F4',
        hasConflict: false,
        conflictingWith: [],
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error creating event');
    res.status(500).json({ error: 'Failed to create event' });
  }
}

export async function updateEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, description, location, startTime, endTime } = req.body;

    const [updated] = await db
      .update(events)
      .set({
        title,
        description,
        location,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(events.id, targetId))
      .returning();

    res.json({ event: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error updating event');
    res.status(500).json({ error: 'Failed to update event' });
  }
}

export async function deleteEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await db.delete(events).where(eq(events.id, targetId));
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting event');
    res.status(500).json({ error: 'Failed to delete event' });
  }
}

export async function listCalendars(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const cals = await db.select().from(calendars);
    res.json({ calendars: cals });
  } catch (err: any) {
    logger.error({ err }, 'Error listing calendars');
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
}
