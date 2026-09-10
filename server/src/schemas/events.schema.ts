import { z } from 'zod';

export const createEventSchema = z.object({
  calendarId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]),
  endTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]),
  timezone: z.string().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]).optional(),
  endTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]).optional(),
});

export const eventIdParamSchema = z.object({
  id: z.string().uuid('Invalid event ID format'),
});
