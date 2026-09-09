import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const saveMemorySchema = z.object({
  text: z.string().min(1, 'Memory text is required'),
  category: z.string().optional(),
});

type SaveMemoryArgs = z.infer<typeof saveMemorySchema>;

export const saveMemoryTool: ToolDefinition<SaveMemoryArgs, any> = {
  name: 'save_memory',
  description: 'Persist a fact, preference, or note into user long-term memory. (Stage 3 memory interface stub)',
  permissionClass: 'write',
  schema: saveMemorySchema,
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Content or statement to remember' },
      category: { type: 'string', description: 'Optional classification category' },
    },
    required: ['text'],
  },
  generateImpactPreview: (args) => ({
    action: 'Save to Memory',
    content: args.text,
    category: args.category || 'general',
  }),
  execute: async (_userId, args) => {
    return {
      saved: true,
      text: args.text,
      note: 'Semantic vector memory indexing is scheduled for Stage 3 activation.',
    };
  },
};
