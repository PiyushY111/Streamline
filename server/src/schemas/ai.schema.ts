import { z } from 'zod';

export const updateAiPreferencesSchema = z.object({
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, 'Time must be in HH:MM or HH:MM:SS format')
    .optional(),
  digestTimezone: z.string().min(1).optional(),
  digestDeliveryMode: z.enum(['in_app', 'email', 'both']).optional(),
  isAutoTriageEnabled: z.boolean().optional(),
  vipSenders: z.array(z.string().email('Invalid email in VIP list')).optional(),
  customInstructions: z.string().max(1000).optional(),
});

export const convertRadarTaskSchema = z.object({
  emailId: z.string().uuid('Invalid email ID'),
  taskId: z.string().min(1, 'Task ID is required'),
  title: z.string().min(1, 'Task title is required'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
});

export const dismissRadarTaskSchema = z.object({
  emailId: z.string().uuid('Invalid email ID'),
  taskId: z.string().min(1, 'Task ID is required'),
});

export const draftReplySchema = z.object({
  threadId: z.string().optional(),
  emailId: z.string().optional(),
  tone: z.enum(['professional', 'concise', 'friendly', 'decline', 'counter_propose']).default('professional'),
  customPrompt: z.string().max(1000).optional(),
  emailContext: z.string().max(10000).optional(),
  replyType: z.enum(['reply', 'reply_all']).default('reply'),
});

export const threadIdParamSchema = z.object({
  threadId: z.string().min(1, 'Thread ID is required'),
});
