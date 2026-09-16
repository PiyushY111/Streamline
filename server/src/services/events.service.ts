import { db } from '../db/index.js';
import { connectedAccounts, calendars } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { eventsRepository } from '../repositories/events.repository.js';
import { logger } from '../utils/logger.js';
import { toError } from '../utils/errors.js';

export class EventsService {
  async getEvents(userId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return eventsRepository.listUserEvents(userId, start, end);
  }

  async getCalendars(userId: string) {
    return eventsRepository.listUserCalendars(userId);
  }

  async createEvent(
    userId: string,
    data: {
      calendarId?: string;
      accountId?: string;
      externalEventId?: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string | Date;
      endTime: string | Date;
      timezone?: string;
      attendees?: string[];
    }
  ) {
    let accountId = data.accountId;
    if (!accountId) {
      const accountsList = await db
        .select({ id: connectedAccounts.id, status: connectedAccounts.status })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, userId));

      if (accountsList.length === 0) {
        throw new Error('No connected Google account found. Please connect an account first.');
      }
      const activeAcc = accountsList.find((a) => a.status === 'active') || accountsList[0];
      accountId = activeAcc.id;
    } else {
      const [userAcc] = await db
        .select({ id: connectedAccounts.id })
        .from(connectedAccounts)
        .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
        .limit(1);
      if (!userAcc) {
        throw new Error('Specified calendar account does not belong to the authenticated user.');
      }
    }

    let calendarId = data.calendarId;
    if (!calendarId) {
      const primaryCal = await eventsRepository.getOrCreatePrimaryCalendar(accountId);
      calendarId = primaryCal.id;
    }

    let externalEventId = data.externalEventId;
    let htmlLink: string | undefined;

    // Collect any attendee emails from data or description/title
    const attendeeEmails = new Set<string>(data.attendees || []);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const descMatches = (data.description || '').match(emailRegex) || [];
    const titleMatches = (data.title || '').match(emailRegex) || [];
    for (const em of [...descMatches, ...titleMatches]) {
      attendeeEmails.add(em);
    }

    // Push event to Google Calendar API
    try {
      const { getGmailClientForAccount } = await import('./google/gmail-sync.service.js');
      const clientData = await getGmailClientForAccount(accountId);
      if (clientData?.oauth2Client) {
        const { google } = await import('googleapis');
        const calendarApi = google.calendar({ version: 'v3', auth: clientData.oauth2Client });

        const [calRow] = await db
          .select({ externalId: calendars.externalCalendarId, isPrimary: calendars.isPrimary })
          .from(calendars)
          .where(eq(calendars.id, calendarId))
          .limit(1);

        const targetExternalCalId = calRow?.isPrimary ? 'primary' : (calRow?.externalId || 'primary');

        const insertPayload: any = {
          calendarId: targetExternalCalId,
          requestBody: {
            summary: data.title || 'Untitled Event',
            description: data.description || '',
            location: data.location || '',
            start: {
              dateTime: new Date(data.startTime || Date.now()).toISOString(),
              timeZone: data.timezone || 'UTC',
            },
            end: {
              dateTime: new Date(data.endTime || Date.now() + 3600 * 1000).toISOString(),
              timeZone: data.timezone || 'UTC',
            },
          },
        };

        if (attendeeEmails.size > 0) {
          insertPayload.requestBody.attendees = Array.from(attendeeEmails).map((email) => ({ email }));
          insertPayload.sendUpdates = 'all';
        }

        const googleRes = await calendarApi.events.insert(insertPayload);
        if (googleRes.data.id) {
          externalEventId = googleRes.data.id;
          htmlLink = googleRes.data.htmlLink || undefined;
          logger.info({ accountId, externalEventId, htmlLink }, 'Event successfully pushed live to Google Calendar');
        }
      }
    } catch (rawErr: unknown) {
      const gErr = toError(rawErr);
      logger.warn({ err: gErr.message, accountId }, 'Failed to push event directly to Google Calendar API, persisting to local DB');
    }

    if (!externalEventId) {
      externalEventId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    return eventsRepository.create({
      userId,
      calendarId,
      accountId,
      externalEventId,
      title: data.title || 'Untitled Event',
      description: data.description,
      location: data.location,
      startTime: new Date(data.startTime || Date.now()),
      endTime: new Date(data.endTime || Date.now() + 3600 * 1000),
      timezone: data.timezone,
      htmlLink,
    });
  }

  async updateEvent(
    id: string,
    userId: string,
    data: Partial<{ title: string; description: string; startTime: string | Date; endTime: string | Date; location: string }>
  ) {
    return eventsRepository.update(id, userId, {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    });
  }

  async deleteEvent(id: string, userId: string) {
    return eventsRepository.delete(id, userId);
  }
}

export const eventsService = new EventsService();
