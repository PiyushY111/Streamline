import { z } from 'zod';
import { tasksRepository } from '../../../../repositories/tasks.repository.js';
import type { ToolDefinition } from './types.js';

const getTasksSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'completed', 'all']).optional(),
  projectId: z.string().uuid().optional(),
});

type GetTasksArgs = z.infer<typeof getTasksSchema>;

export const getTasksTool: ToolDefinition<GetTasksArgs, any> = {
  name: 'get_tasks',
  description: "Retrieve the user's tasks, optionally filtered by status ('todo', 'in_progress', 'completed') or project ID.",
  permissionClass: 'read',
  schema: getTasksSchema,
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['todo', 'in_progress', 'completed', 'all'],
        description: 'Optional filter by task completion status.',
      },
      projectId: {
        type: 'string',
        description: 'Optional UUID of project to filter tasks by.',
      },
    },
  },
  generateImpactPreview: (args) => ({
    action: 'Query Tasks',
    filterStatus: args.status || 'all',
    projectId: args.projectId || 'all',
  }),
  execute: async (userId, args) => {
    const all = await tasksRepository.listUserTasks(userId);
    let filtered = all;
    if (args.status && args.status !== 'all') {
      filtered = filtered.filter((t) => t.status === args.status);
    }
    if (args.projectId) {
      filtered = filtered.filter((t) => t.projectId === args.projectId);
    }
    return filtered.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      importance: t.importance,
      estimatedMinutes: t.estimatedMinutes,
      dueAt: t.dueAt,
    }));
  },
};
