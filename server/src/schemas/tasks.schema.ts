import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.union([z.string().datetime(), z.date(), z.string().min(1), z.null()]).optional(),
  sourceEmailId: z.string().uuid().nullable().optional(),
  sourceEventId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().min(1).nullable().optional(),
  dependencies: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueAt: z.union([z.string().datetime(), z.date(), z.string().min(1), z.null()]).optional(),
  projectId: z.string().uuid().nullable().optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().min(1).nullable().optional(),
  dependencies: z.array(z.string()).optional(),
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
});
