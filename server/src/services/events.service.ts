import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { eventsRepository } from '../repositories/events.repository.js';

export class EventsService {
  async getEvents(userId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return eventsRepository.listUserEvents(userId, start, end);
  }

  async getCalendars(userId: string) {
    return eventsRepository.listUserCalendars(userId);
  }

  async createEvent(userId: string, data: {
    calendarId?: string;
    accountId?: string;
    externalEventId?: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
  }) {
    let accountId = data.accountId;
    if (!accountId) {
      const accountsList = await db.select({ id: connectedAccounts.id })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, userId))
        .limit(1);
      if (accountsList.length === 0) {
        throw new Error('No connected Google account found. Please connect an account first.');
      }
      accountId = accountsList[0].id;
    }

    let calendarId = data.calendarId;
    if (!calendarId) {
      const primaryCal = await eventsRepository.getOrCreatePrimaryCalendar(accountId);
      calendarId = primaryCal.id;
    }

    const externalEventId = data.externalEventId || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return eventsRepository.create({
      calendarId,
      accountId,
      externalEventId,
      title: data.title || 'Untitled Event',
      description: data.description,
      location: data.location,
      startTime: new Date(data.startTime || Date.now()),
      endTime: new Date(data.endTime || Date.now() + 3600 * 1000),
    });
  }

  async updateEvent(id: string, data: Partial<{ title: string; description: string; startTime: string; endTime: string }>) {
    return eventsRepository.update(id, {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    });
  }

  async deleteEvent(id: string) {
    return eventsRepository.delete(id);
  }
}

export const eventsService = new EventsService();
