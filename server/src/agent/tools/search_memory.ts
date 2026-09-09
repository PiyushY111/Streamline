import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const searchMemorySchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().min(1).max(20).default(5),
});

type SearchMemoryArgs = z.infer<typeof searchMemorySchema>;

export const searchMemoryTool: ToolDefinition<SearchMemoryArgs, any> = {
  name: 'search_memory',
  description: 'Search personal long-term memory, preferences, and user facts using semantic search. (Stage 3 memory interface stub)',
  permissionClass: 'read',
  schema: searchMemorySchema,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query text to search memory against' },
      limit: { type: 'number', description: 'Maximum number of items to return' },
    },
    required: ['query'],
  },
  generateImpactPreview: (args) => ({
    action: 'Recall Memory',
    query: args.query,
  }),
  execute: async (_userId, args) => {
    return {
      query: args.query,
      memories: [],
      note: 'Semantic vector memory indexing is scheduled for Stage 3 activation.',
    };
  },
};
