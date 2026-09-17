import { z } from 'zod';

export const clientSendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient email is required'),
  subject: z.string().default(''),
  body: z.string().default(''),
  accountId: z.string().uuid('Invalid account ID').optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
});

export type ClientSendEmailInput = z.infer<typeof clientSendEmailSchema>;

export function validateEmailForm(
  data: unknown,
): { success: true; data: ClientSendEmailInput } | { success: false; errors: Record<string, string> } {
  const result = clientSendEmailSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0]?.toString() || 'root';
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}
