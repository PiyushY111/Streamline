import { z } from 'zod';
import type { ToolDefinition } from './types.js';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.string().optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().min(1).optional(),
  projectId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
});

type CreateTaskArgs = z.infer<typeof createTaskSchema>;

export const createTaskTool: ToolDefinition<CreateTaskArgs, any> = {
  name: 'create_task',
  description: 'Propose creating a new task or action item. This is a WRITE action that ALWAYS requires explicit human approval before execution.',
  permissionClass: 'write',
  schema: createTaskSchema,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Actionable title of the task' },
      description: { type: 'string', description: 'Optional context, details, or checklist items' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority level' },
      dueAt: { type: 'string', description: 'Optional ISO deadline date for completion' },
      importance: { type: 'number', description: 'Strategic importance score between 0.0 and 1.0' },
      estimatedMinutes: { type: 'number', description: 'Estimated time required to complete the task in minutes' },
      projectId: { type: 'string', description: 'Optional project UUID to associate task with' },
      idempotencyKey: { type: 'string', description: 'Optional unique client-provided idempotency key' },
    },
    required: ['title'],
  },
  generateImpactPreview: (args) => ({
    action: 'Create Task',
    title: args.title,
    priority: args.priority || 'medium',
    importance: `${Math.round((args.importance ?? 0.5) * 100)}%`,
    estimatedMinutes: args.estimatedMinutes ? `${args.estimatedMinutes}m` : 'Not specified',
    dueAt: args.dueAt || 'No deadline',
  }),
  execute: async (userId, args) => {
    if (args.idempotencyKey) {
      const { getCache, setCache } = await import('../../../../services/cache.service.js');
      const cacheKey = `idempotency:tool:create_task:${userId}:${args.idempotencyKey}`;
      const cached = await getCache<any>(cacheKey);
      if (cached) return cached;

      const { tasksRepository } = await import('../../../../repositories/tasks.repository.js');
      const result = await tasksRepository.create({
        userId,
        title: args.title,
        description: args.description,
        priority: args.priority,
        dueAt: args.dueAt ? new Date(args.dueAt) : undefined,
        importance: args.importance ?? 0.5,
        estimatedMinutes: args.estimatedMinutes,
        projectId: args.projectId,
      });
      await setCache(cacheKey, result, 86400);
      return result;
    }

    const { tasksRepository } = await import('../../../../repositories/tasks.repository.js');
    return tasksRepository.create({
      userId,
      title: args.title,
      description: args.description,
      priority: args.priority,
      dueAt: args.dueAt ? new Date(args.dueAt) : undefined,
      importance: args.importance ?? 0.5,
      estimatedMinutes: args.estimatedMinutes,
      projectId: args.projectId,
    });
  },
};
