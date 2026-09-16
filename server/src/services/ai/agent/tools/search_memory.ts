import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { searchMemory, MemoryType } from '../../memory/memory.service.js';

const searchMemorySchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['preference', 'decision', 'project_fact']).optional(),
  limit: z.number().min(1).max(10).default(3),
});

type SearchMemoryArgs = z.infer<typeof searchMemorySchema>;

export const searchMemoryTool: ToolDefinition<SearchMemoryArgs, any> = {
  name: 'search_memory',
  description:
    "Search the user's stored preferences, past decisions, and project facts for relevant context using hybrid semantic and keyword retrieval.",
  permissionClass: 'read',
  schema: searchMemorySchema,
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query text to search memory against' },
      type: {
        type: 'string',
        enum: ['preference', 'decision', 'project_fact'],
        description: 'Optional category filter',
      },
      limit: { type: 'number', description: 'Maximum number of items to return (1-10)' },
    },
    required: ['query'],
  },
  generateImpactPreview: (args) => ({
    action: 'Recall Memory',
    query: args.query,
    type: args.type || 'all',
  }),
  execute: async (userId, args) => {
    const results = await searchMemory(userId, args.query, {
      type: args.type as MemoryType | undefined,
      topK: args.limit || 3,
    });

    return {
      query: args.query,
      count: results.length,
      memories: results.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        relevanceScore: m.score,
      })),
    };
  },
};
