import { z } from 'zod';
import { eventsRepository } from '../../../../repositories/events.repository.js';
import type { ToolDefinition } from './types.js';

const findFreeSlotsSchema = z.object({
  windowHours: z.number().min(1).max(168).default(24),
  minDurationMinutes: z.number().min(5).max(480).default(15),
});

type FindFreeSlotsArgs = z.infer<typeof findFreeSlotsSchema>;

export const findFreeSlotsTool: ToolDefinition<FindFreeSlotsArgs, any> = {
  name: 'find_free_slots',
  description: 'Find open, available calendar time slots within the next N hours, accounting for 10-minute transition buffers before and after meetings.',
  permissionClass: 'read',
  schema: findFreeSlotsSchema,
  parameters: {
    type: 'object',
    properties: {
      windowHours: {
        type: 'number',
        description: 'Number of hours ahead to search for open slots (default 24).',
      },
      minDurationMinutes: {
        type: 'number',
        description: 'Minimum length of slot in minutes (default 15).',
      },
    },
  },
  generateImpactPreview: (args) => ({
    action: 'Scan Calendar Free Slots',
    searchWindowHours: args.windowHours || 24,
    minDuration: `${args.minDurationMinutes || 15}m`,
  }),
  execute: async (userId, args) => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + (args.windowHours || 24) * 3600 * 1000);
    const slots = await eventsRepository.findSmartFreeSlots(userId, {
      startTime: now,
      endTime: windowEnd,
      minDurationMinutes: args.minDurationMinutes || 15,
      bufferMinutes: 10,
    });

    return slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      durationMinutes: s.durationMinutes,
      formattedRange: `${s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${s.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    }));
  },
};
