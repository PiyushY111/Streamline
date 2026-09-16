import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient (to) is required'),
  subject: z.string().default(''),
  body: z.string().default(''),
  accountId: z.string().uuid('Invalid account ID format').optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string(),
        size: z.number().optional(),
        content: z.string().optional(),
      }),
    )
    .optional(),
});

export const emailIdParamSchema = z.object({
  id: z.string().uuid('Invalid email ID format'),
});

export const markEmailReadSchema = z.object({
  isRead: z.boolean().optional(),
});

export const starEmailSchema = z.object({
  isStarred: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  category: z.enum(['primary', 'social', 'updates', 'promotions', 'spam', 'trash']),
});
