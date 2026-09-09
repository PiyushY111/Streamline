import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsRepository } from '../repositories/events.repository.js';

describe('Events Repository - Smart Free Slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates free slots taking into account 10-minute buffers', async () => {
    const baseTime = new Date('2026-09-09T10:00:00Z');
    const windowStart = new Date('2026-09-09T10:00:00Z');
    const windowEnd = new Date('2026-09-09T14:00:00Z'); // 4 hours window = 240 mins

    // Meeting from 11:00 to 12:00
    // With 10 min buffer:
    // Busy interval: 10:50 to 12:10
    // Gap 1: 10:00 to 10:50 = 50 mins
    // Gap 2: 12:10 to 14:00 = 110 mins
    vi.spyOn(eventsRepository, 'listUserEvents').mockResolvedValue([
      {
        id: 'event-1',
        title: 'Team Standup',
        startTime: new Date('2026-09-09T11:00:00Z'),
        endTime: new Date('2026-09-09T12:00:00Z'),
        status: 'confirmed',
        accountId: 'acc-1',
        calendarId: 'cal-1',
        externalEventId: 'ext-1',
        description: null,
        location: null,
        timezone: 'UTC',
        accountName: 'Work',
        accountColor: '#3b82f6',
        hasConflict: false,
        conflictingWith: [],
      } as any,
    ]);

    const slots = await eventsRepository.findSmartFreeSlots('user-1', {
      startTime: windowStart,
      endTime: windowEnd,
      minDurationMinutes: 15,
      bufferMinutes: 10,
    });

    expect(slots.length).toBe(2);
    expect(slots[0].durationMinutes).toBe(50);
    expect(slots[0].start.toISOString()).toBe('2026-09-09T10:00:00.000Z');
    expect(slots[0].end.toISOString()).toBe('2026-09-09T10:50:00.000Z');

    expect(slots[1].durationMinutes).toBe(110);
    expect(slots[1].start.toISOString()).toBe('2026-09-09T12:10:00.000Z');
    expect(slots[1].end.toISOString()).toBe('2026-09-09T14:00:00.000Z');
  });

  it('merges overlapping meetings and buffers properly', async () => {
    const windowStart = new Date('2026-09-09T10:00:00Z');
    const windowEnd = new Date('2026-09-09T13:00:00Z'); // 3 hours

    // Meeting 1: 10:30 - 11:15 (busy 10:20 - 11:25 with 10m buffer)
    // Meeting 2: 11:20 - 12:00 (busy 11:10 - 12:10 with 10m buffer)
    // Combined busy: 10:20 to 12:10
    // Gap 1: 10:00 - 10:20 (20 mins)
    // Gap 2: 12:10 - 13:00 (50 mins)
    vi.spyOn(eventsRepository, 'listUserEvents').mockResolvedValue([
      {
        id: 'event-1',
        title: 'Meeting 1',
        startTime: new Date('2026-09-09T10:30:00Z'),
        endTime: new Date('2026-09-09T11:15:00Z'),
        status: 'confirmed',
        accountId: 'acc-1',
      } as any,
      {
        id: 'event-2',
        title: 'Meeting 2',
        startTime: new Date('2026-09-09T11:20:00Z'),
        endTime: new Date('2026-09-09T12:00:00Z'),
        status: 'confirmed',
        accountId: 'acc-1',
      } as any,
    ]);

    const slots = await eventsRepository.findSmartFreeSlots('user-1', {
      startTime: windowStart,
      endTime: windowEnd,
      minDurationMinutes: 15,
      bufferMinutes: 10,
    });

    expect(slots.length).toBe(2);
    expect(slots[0].durationMinutes).toBe(20);
    expect(slots[1].durationMinutes).toBe(50);
  });
});
