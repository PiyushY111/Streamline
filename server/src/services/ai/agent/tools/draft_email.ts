import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const draftEmailSchema = z.object({
  to: z.string().min(1, 'Recipient email is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body content is required'),
});

type DraftEmailArgs = z.infer<typeof draftEmailSchema>;

export const draftEmailTool: ToolDefinition<DraftEmailArgs, any> = {
  name: 'draft_email',
  description:
    'Draft an email message safely. Generates the subject and body without sending or producing side effects.',
  permissionClass: 'read',
  schema: draftEmailSchema,
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Subject line of the email' },
      body: { type: 'string', description: 'Body text content of the email' },
    },
    required: ['to', 'subject', 'body'],
  },
  generateImpactPreview: (args) => ({
    action: 'Draft Email',
    to: args.to,
    subject: args.subject,
    preview: args.body.slice(0, 100),
  }),
  execute: async (_userId, args) => {
    return {
      draftReady: true,
      to: args.to,
      subject: args.subject,
      body: args.body,
      note: 'Draft prepared. Use send_email when ready to propose dispatch for human approval.',
    };
  },
};
