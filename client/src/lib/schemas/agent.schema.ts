import { z } from 'zod';

export const clientAgentChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID').optional(),
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message is too long'),
});

export const clientApproveActionSchema = z.object({
  actionId: z.string().uuid('Invalid action ID'),
  idempotencyKey: z.string().optional(),
});

export type ClientAgentChatInput = z.infer<typeof clientAgentChatSchema>;
export type ClientApproveActionInput = z.infer<typeof clientApproveActionSchema>;
