import { db } from '../db/index.js';
import { events, calendars, connectedAccounts } from '../db/schema/index.js';
import { eq, inArray, gte, lte, and, desc } from 'drizzle-orm';

export class EventsRepository {
  async listUserEvents(userId: string, startDate?: Date, endDate?: Date) {
    const userAccounts = await db.select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountIds = userAccounts.map((a: { id: string }) => a.id);
    const conditions = [inArray(events.accountId, accountIds)];

    if (startDate) conditions.push(gte(events.startTime, startDate));
    if (endDate) conditions.push(lte(events.endTime, endDate));

    return db.select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.startTime));
  }

  async listUserCalendars(userId: string) {
    const userAccounts = await db.select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountIds = userAccounts.map((a: { id: string }) => a.id);
    return db.select().from(calendars).where(inArray(calendars.accountId, accountIds));
  }

  async create(data: {
    calendarId: string;
    accountId: string;
    externalEventId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    timezone?: string;
  }) {
    const [newEvent] = await db.insert(events).values({
      calendarId: data.calendarId,
      accountId: data.accountId,
      externalEventId: data.externalEventId,
      title: data.title,
      description: data.description,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
    }).returning();
    return newEvent;
  }

  async update(id: string, data: Partial<{ title: string; description: string; startTime: Date; endTime: Date }>) {
    const [updated] = await db.update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    return db.delete(events).where(eq(events.id, id));
  }
}

export const eventsRepository = new EventsRepository();
