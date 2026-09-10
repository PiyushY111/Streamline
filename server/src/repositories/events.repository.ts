import { db } from '../db/index.js';
import { events, calendars, connectedAccounts } from '../db/schema/index.js';
import { eq, inArray, gte, lte, and, desc, ne } from 'drizzle-orm';

export class EventsRepository {
  private async getUserAccountIds(userId: string): Promise<string[]> {
    const userAccounts = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));
    return userAccounts.map((a) => a.id);
  }

  async listUserEvents(userId: string, startDate?: Date, endDate?: Date) {
    const userAccounts = await db
      .select({
        id: connectedAccounts.id,
        label: connectedAccounts.label,
        email: connectedAccounts.email,
        color: connectedAccounts.color,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountIds = userAccounts.map((a: { id: string }) => a.id);
    const conditions = [
      inArray(events.accountId, accountIds),
      ne(events.status, 'cancelled'),
    ];

    if (startDate) conditions.push(gte(events.startTime, startDate));
    if (endDate) conditions.push(lte(events.endTime, endDate));

    const eventRows = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.startTime));

    const accountMap = new Map(userAccounts.map((a) => [a.id, a]));

    return eventRows.map((e, _, arr) => {
      const acc = accountMap.get(e.accountId);
      const eStart = new Date(e.startTime).getTime();
      const eEnd = new Date(e.endTime).getTime();

      const isAllDay = eEnd - eStart >= 24 * 60 * 60 * 1000;
      let conflicts: typeof arr = [];

      if (!isAllDay && !isNaN(eStart) && !isNaN(eEnd)) {
        conflicts = arr.filter((other) => {
          if (other.id === e.id) return false;
          const oStart = new Date(other.startTime).getTime();
          const oEnd = new Date(other.endTime).getTime();
          const otherAllDay = oEnd - oStart >= 24 * 60 * 60 * 1000;
          if (otherAllDay || isNaN(oStart) || isNaN(oEnd)) return false;

          return eStart < oEnd && eEnd > oStart;
        });
      }

      return {
        ...e,
        accountName: acc?.label || acc?.email || 'Calendar',
        accountColor: acc?.color || '#3b82f6',
        hasConflict: conflicts.length > 0,
        conflictingWith: conflicts.map((c) => c.title),
      };
    });
  }

  async listUserCalendars(userId: string) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return [];

    return db.select().from(calendars).where(inArray(calendars.accountId, accountIds));
  }

  async getOrCreatePrimaryCalendar(accountId: string) {
    const [primary] = await db
      .select()
      .from(calendars)
      .where(and(eq(calendars.accountId, accountId), eq(calendars.isPrimary, true)))
      .limit(1);
    if (primary) return primary;

    const [existing] = await db.select().from(calendars).where(eq(calendars.accountId, accountId)).limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(calendars)
      .values({
        accountId,
        externalCalendarId: 'primary',
        name: 'Primary Calendar',
        isPrimary: true,
      })
      .returning();
    return created;
  }

  async create(data: {
    userId: string;
    calendarId: string;
    accountId: string;
    externalEventId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    timezone?: string;
    htmlLink?: string;
  }) {
    // Verify account belongs to user
    const accountIds = await this.getUserAccountIds(data.userId);
    if (!accountIds.includes(data.accountId)) {
      throw new Error('Account does not belong to user.');
    }

    const [newEvent] = await db
      .insert(events)
      .values({
        calendarId: data.calendarId,
        accountId: data.accountId,
        externalEventId: data.externalEventId,
        title: data.title,
        description: data.description,
        location: data.location,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone,
        htmlLink: data.htmlLink || '',
      })
      .returning();
    return newEvent;
  }

  async update(id: string, userId: string, data: Partial<{ title: string; description: string; startTime: Date; endTime: Date; location: string }>) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return null;

    const [updated] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(events.id, id), inArray(events.accountId, accountIds)))
      .returning();
    return updated || null;
  }

  async delete(id: string, userId: string) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return { rowCount: 0 };

    return db
      .delete(events)
      .where(and(eq(events.id, id), inArray(events.accountId, accountIds)));
  }

  /**
   * Stage 1: Deterministic smart calendar slot search with buffer times.
   * Finds free gaps in the user's schedule between startTime and endTime.
   */
  async findSmartFreeSlots(
    userId: string,
    options: {
      startTime?: Date;
      endTime?: Date;
      minDurationMinutes?: number;
      bufferMinutes?: number;
    } = {}
  ): Promise<Array<{ start: Date; end: Date; durationMinutes: number }>> {
    const now = new Date();
    const windowStart = options.startTime || now;
    const windowEnd = options.endTime || new Date(now.getTime() + 24 * 60 * 60 * 1000); // default 24h
    const minDuration = options.minDurationMinutes ?? 15;
    const bufferMs = (options.bufferMinutes ?? 10) * 60 * 1000;

    const userEvents = await this.listUserEvents(userId, windowStart, windowEnd);

    // Filter to timed events overlapping the window, sorted by start time
    const sortedEvents = userEvents
      .map((e) => ({
        start: new Date(e.startTime).getTime(),
        end: new Date(e.endTime).getTime(),
      }))
      .filter((e) => !isNaN(e.start) && !isNaN(e.end) && e.end > windowStart.getTime() && e.start < windowEnd.getTime())
      .sort((a, b) => a.start - b.start);

    // Merge overlapping/adjacent busy intervals (including buffer)
    const busyIntervals: Array<{ start: number; end: number }> = [];
    for (const evt of sortedEvents) {
      const bStart = Math.max(windowStart.getTime(), evt.start - bufferMs);
      const bEnd = Math.min(windowEnd.getTime(), evt.end + bufferMs);

      if (busyIntervals.length === 0) {
        busyIntervals.push({ start: bStart, end: bEnd });
      } else {
        const last = busyIntervals[busyIntervals.length - 1];
        if (bStart <= last.end) {
          last.end = Math.max(last.end, bEnd);
        } else {
          busyIntervals.push({ start: bStart, end: bEnd });
        }
      }
    }

    // Find gaps between busy intervals
    const freeSlots: Array<{ start: Date; end: Date; durationMinutes: number }> = [];
    let cursor = windowStart.getTime();

    for (const busy of busyIntervals) {
      if (busy.start > cursor) {
        const gapDurationMinutes = Math.floor((busy.start - cursor) / (60 * 1000));
        if (gapDurationMinutes >= minDuration) {
          freeSlots.push({
            start: new Date(cursor),
            end: new Date(busy.start),
            durationMinutes: gapDurationMinutes,
          });
        }
      }
      cursor = Math.max(cursor, busy.end);
    }

    if (windowEnd.getTime() > cursor) {
      const gapDurationMinutes = Math.floor((windowEnd.getTime() - cursor) / (60 * 1000));
      if (gapDurationMinutes >= minDuration) {
        freeSlots.push({
          start: new Date(cursor),
          end: new Date(windowEnd.getTime()),
          durationMinutes: gapDurationMinutes,
        });
      }
    }

    return freeSlots;
  }
}

export const eventsRepository = new EventsRepository();

