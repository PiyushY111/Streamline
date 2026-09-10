import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const createCalendarEventSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Start time must be a valid ISO datetime'),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'End time must be a valid ISO datetime'),
  description: z.string().optional(),
  location: z.string().optional(),
});

type CreateCalendarEventArgs = z.infer<typeof createCalendarEventSchema>;

export const createCalendarEventTool: ToolDefinition<CreateCalendarEventArgs, any> = {
  name: 'create_calendar_event',
  description: 'Propose creating a new calendar event on the user’s primary calendar. This is a WRITE action that ALWAYS requires explicit human approval before execution.',
  permissionClass: 'write',
  schema: createCalendarEventSchema,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title or summary of the meeting/event' },
      startTime: { type: 'string', description: 'ISO 8601 formatted datetime string (e.g. 2026-09-10T14:00:00Z)' },
      endTime: { type: 'string', description: 'ISO 8601 formatted datetime string (e.g. 2026-09-10T15:00:00Z)' },
      description: { type: 'string', description: 'Optional description or agenda for the meeting' },
      location: { type: 'string', description: 'Optional location or video call meeting link' },
    },
    required: ['title', 'startTime', 'endTime'],
  },
  generateImpactPreview: (args) => {
    const s = new Date(args.startTime);
    const e = new Date(args.endTime);
    const durationMins = !isNaN(s.getTime()) && !isNaN(e.getTime()) ? Math.round((e.getTime() - s.getTime()) / 60000) : 60;
    return {
      action: 'Create Calendar Event',
      title: args.title,
      startTime: args.startTime,
      endTime: args.endTime,
      durationMinutes: durationMins,
      calendar: 'Primary Calendar',
      location: args.location || 'None',
      description: args.description || 'None',
    };
  },
  execute: async (userId, args) => {
    const { eventsService } = await import('../../../../services/events.service.js');
    return eventsService.createEvent(userId, {
      title: args.title,
      startTime: args.startTime,
      endTime: args.endTime,
      description: args.description,
      location: args.location,
    });
  },
};
