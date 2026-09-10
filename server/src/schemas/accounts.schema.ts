import { z } from 'zod';

export const updateAccountSchema = z.object({
  label: z.string().min(1, 'Label cannot be empty').max(50, 'Label is too long').optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid 6-character hex code (e.g. #3b82f6)')
    .optional(),
});

export const accountIdParamSchema = z.object({
  id: z.string().uuid('Invalid account ID format'),
});
