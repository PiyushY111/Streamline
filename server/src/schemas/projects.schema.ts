import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived', 'on_hold']).default('active'),
  color: z.string().optional(),
  stack: z.string().optional(),
  currentMilestone: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived', 'on_hold']).optional(),
  color: z.string().optional(),
  stack: z.string().optional(),
  currentMilestone: z.string().optional(),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
});
