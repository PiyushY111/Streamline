import { z } from 'zod';

export const clientCreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.union([z.string().datetime(), z.date(), z.string().min(1), z.null()]).optional(),
  projectId: z.string().uuid('Invalid project ID').nullable().optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().min(1, 'Estimate must be at least 1 minute').nullable().optional(),
  dependencies: z.array(z.string()).optional(),
});

export const clientUpdateTaskSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueAt: z.union([z.string().datetime(), z.date(), z.string().min(1), z.null()]).optional(),
  projectId: z.string().uuid().nullable().optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().min(1).nullable().optional(),
  dependencies: z.array(z.string()).optional(),
});

export type ClientCreateTaskInput = z.infer<typeof clientCreateTaskSchema>;
export type ClientUpdateTaskInput = z.infer<typeof clientUpdateTaskSchema>;

export function validateTaskForm(
  data: unknown,
): { success: true; data: ClientCreateTaskInput } | { success: false; errors: Record<string, string> } {
  const result = clientCreateTaskSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0]?.toString() || 'root';
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}
