import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { saveMemory, MemoryType } from '../../services/ai/memory.service.js';

const saveMemorySchema = z
  .object({
    type: z.string().optional(),
    content: z.string().optional(),
    // Backwards-compatible aliases
    category: z.string().optional(),
    text: z.string().optional(),
  })
  .refine((data) => !!(data.content || data.text), {
    message: 'Memory content is required',
    path: ['content'],
  });

type SaveMemoryArgs = z.infer<typeof saveMemorySchema>;

export const saveMemoryTool: ToolDefinition<SaveMemoryArgs, any> = {
  name: 'save_memory',
  description:
    'Explicitly save a durable user preference, architectural/project decision, or key project fact into long-term memory.',
  /**
   * Classification Note (ADR-0010 / ADR-0011):
   * Writes to internal database, but has ZERO consequential real-world effect (no external email sent,
   * no calendar event altered, no external API mutated). Deliberately classified as 'read' so it does
   * not incur human-in-the-loop confirmation friction for personal productivity notes.
   */
  permissionClass: 'read',
  schema: saveMemorySchema,
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['preference', 'decision', 'project_fact'],
        description: 'Classification category for the durable fact',
      },
      content: {
        type: 'string',
        description: 'The durable statement or fact to remember across future sessions',
      },
      text: {
        type: 'string',
        description: 'Alias for content',
      },
      category: {
        type: 'string',
        description: 'Alias for type',
      },
    },
    required: ['content'],
  },
  generateImpactPreview: (args) => {
    const content = args.content || args.text || '';
    const type = (args.type || args.category || 'preference') as MemoryType;
    return {
      action: 'Save to Long-Term Memory',
      category: type,
      content,
    };
  },
  execute: async (userId, args) => {
    const rawContent = args.content || args.text || '';
    const rawType = args.type || args.category || 'preference';

    let resolvedType: MemoryType = 'preference';
    if (rawType === 'decision') resolvedType = 'decision';
    else if (rawType === 'project_fact') resolvedType = 'project_fact';

    const result = await saveMemory(userId, resolvedType, rawContent, 'explicit_user_request');

    return {
      saved: !!result,
      id: result?.id,
      type: resolvedType,
      content: rawContent,
      message: result ? 'Memory saved successfully.' : 'Failed to save memory.',
    };
  },
};
