import { google } from 'googleapis';
import { db } from '../../db/index.js';
import { calendars, events } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

import { googleTokenManager } from './token-manager.service.js';

export async function syncGoogleCalendar(oauth2Client: any, accountId: string): Promise<number> {
  let auth = oauth2Client;
  if (!auth) {
    const clientData = await googleTokenManager.getCalendarClient(accountId);
    if (!clientData) throw new Error(`Connected account not found for ID: ${accountId}`);
    auth = clientData.oauth2Client;
  }
  const calendarApi = google.calendar({ version: 'v3', auth });
  const calendarListRes = await calendarApi.calendarList.list();
  const calendarItems = calendarListRes.data.items || [];

  let syncedEventCount = 0;
  for (const calItem of calendarItems) {
    if (!calItem.id) continue;

    let calDbId: string;
    const [existingCal] = await db.select().from(calendars)
      .where(and(eq(calendars.accountId, accountId), eq(calendars.externalCalendarId, calItem.id))).limit(1);

    if (existingCal) {
      calDbId = existingCal.id;
    } else {
      const [newCal] = await db.insert(calendars).values({
        accountId,
        externalCalendarId: calItem.id,
        name: calItem.summary || 'Google Calendar',
        description: calItem.description || '',
        timezone: calItem.timeZone || 'UTC',
        color: calItem.backgroundColor || '#3b82f6',
        isPrimary: Boolean(calItem.primary),
        isVisible: true,
      }).returning();
      calDbId = newCal.id;
    }

    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const eventsRes = await calendarApi.events.list({
      calendarId: calItem.id,
      timeMin,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const eventItems = eventsRes.data.items || [];
    for (const evt of eventItems) {
      if (!evt.id || !evt.summary) continue;

      const rawStart = evt.start?.dateTime || evt.start?.date;
      const rawEnd = evt.end?.dateTime || evt.end?.date;
      const startTime = rawStart ? new Date(rawStart) : new Date();
      const endTime = rawEnd ? new Date(rawEnd) : new Date();

      await db.insert(events).values({
        calendarId: calDbId,
        accountId,
        externalEventId: evt.id,
        title: evt.summary,
        description: evt.description || '',
        location: evt.location || '',
        startTime,
        endTime,
        timezone: evt.start?.timeZone || calItem.timeZone || 'UTC',
        status: evt.status || 'confirmed',
        htmlLink: evt.htmlLink || '',
      }).onConflictDoNothing();

      syncedEventCount++;
    }
  }

  logger.info({ accountId, syncedEventCount }, 'Google Calendar sync completed');
  return syncedEventCount;
}
