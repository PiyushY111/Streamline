import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const sendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient email is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  accountId: z.string().uuid().optional(),
});

type SendEmailArgs = z.infer<typeof sendEmailSchema>;

export const sendEmailTool: ToolDefinition<SendEmailArgs, any> = {
  name: 'send_email',
  description: 'Propose dispatching an external email to a recipient via Google Workspace / Gmail. This is a highly consequential SEND action that ALWAYS requires explicit human approval before transmission.',
  permissionClass: 'send',
  schema: sendEmailSchema,
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address (e.g. sarah@example.com)' },
      subject: { type: 'string', description: 'Subject line of the email' },
      body: { type: 'string', description: 'The body text content to be sent to the recipient' },
      accountId: { type: 'string', description: 'Optional connected account UUID to send from' },
    },
    required: ['to', 'subject', 'body'],
  },
  generateImpactPreview: (args) => ({
    action: 'Send External Email',
    to: args.to,
    subject: args.subject,
    bodySnippet: args.body.length > 150 ? `${args.body.slice(0, 150)}...` : args.body,
    characterCount: args.body.length,
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
