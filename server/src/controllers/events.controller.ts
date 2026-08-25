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
          // Overlap detected!
          if (!conflictsMap[eventA.id]) conflictsMap[eventA.id] = [];
          if (!conflictsMap[eventB.id]) conflictsMap[eventB.id] = [];
          conflictsMap[eventA.id].push(eventB.id);
          conflictsMap[eventB.id].push(eventA.id);
        } else {
          break; // Since list is sorted by startTime
        }
      }
    }

    const processedEvents: EventWithConflict[] = rawEvents.map((evt) => ({
      ...evt,
      accountName: evt.accountName || 'Calendar',
      accountColor: evt.accountColor || '#8b5cf6',
      hasConflict: Boolean(conflictsMap[evt.id] && conflictsMap[evt.id].length > 0),
      conflictingWith: conflictsMap[evt.id] || [],
    }));

    res.json({ events: processedEvents });
  } catch (err: any) {
    logger.error({ err }, 'Error listing agenda events from database');
    res.status(500).json({ error: 'Failed to fetch agenda events' });
  }
}
