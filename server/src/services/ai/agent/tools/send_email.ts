import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const sendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient email is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  accountId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        url: z.string().optional(),
        content: z.string().optional(),
        previewUrl: z.string().optional(),
      }),
    )
    .optional(),
});

type SendEmailArgs = z.infer<typeof sendEmailSchema>;

export const sendEmailTool: ToolDefinition<SendEmailArgs, any> = {
  name: 'send_email',
  description:
    'Propose dispatching an external email to a recipient via Google Workspace / Gmail. This is a highly consequential SEND action that ALWAYS requires explicit human approval before transmission.',
  permissionClass: 'send',
  schema: sendEmailSchema,
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address (e.g. sarah@example.com)' },
      subject: { type: 'string', description: 'Subject line of the email' },
      body: { type: 'string', description: 'The body text content to be sent to the recipient' },
      accountId: { type: 'string', description: 'Optional connected account UUID to send from' },
      idempotencyKey: { type: 'string', description: 'Unique idempotency key to prevent duplicate email dispatch' },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            url: { type: 'string' },
          },
          required: ['filename'],
        },
        description: 'Optional list of file attachments to include with the email',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  generateImpactPreview: (args) => ({
    action: 'Send External Email',
    to: args.to,
    subject: args.subject,
    body: args.body,
    bodySnippet: args.body.length > 200 ? `${args.body.slice(0, 200)}...` : args.body,
    characterCount: args.body.length,
    attachments: args.attachments || [],
    consequence: 'External email will be sent from your connected account immediately upon approval.',
  }),
  execute: async (userId, args) => {
    const { emailsService } = await import('../../../../services/emails.service.js');
    return emailsService.sendEmail(userId, {
      to: args.to,
      subject: args.subject,
      body: args.body,
      accountId: args.accountId,
    });
  },
};
