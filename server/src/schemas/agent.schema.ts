import { z } from 'zod';

export const agentChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format').optional(),
  message: z.string().min(1, 'Message cannot be empty'),
});

export const pendingActionIdParamSchema = z.object({
  id: z.string().uuid('Invalid pending action ID format'),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
});

export const memoryIdParamSchema = z.object({
  id: z.string().uuid('Invalid memory ID format'),
});
