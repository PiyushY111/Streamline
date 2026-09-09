import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().optional(),
});

// Account Schemas
export const updateAccountSchema = z.object({
  label: z.string().min(1, 'Label cannot be empty').max(50, 'Label is too long').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid 6-character hex code (e.g. #3b82f6)').optional(),
});

export const accountIdParamSchema = z.object({
  id: z.string().uuid('Invalid account ID format'),
});

// Email Schemas
export const sendEmailSchema = z.object({
  to: z.string().min(1, 'Recipient (to) is required'),
  subject: z.string().default(''),
  body: z.string().default(''),
  accountId: z.string().uuid('Invalid account ID format').optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  attachments: z.array(
    z.object({
      filename: z.string().min(1),
      mimeType: z.string(),
      size: z.number().optional(),
      content: z.string().optional(),
    })
  ).optional(),
});

export const emailIdParamSchema = z.object({
  id: z.string().uuid('Invalid email ID format'),
});

export const markEmailReadSchema = z.object({
  isRead: z.boolean().optional(),
});

export const starEmailSchema = z.object({
  isStarred: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  category: z.enum(['primary', 'social', 'updates', 'promotions', 'spam', 'trash']),
});

// Event Schemas
export const createEventSchema = z.object({
  calendarId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]),
  endTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]),
  timezone: z.string().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]).optional(),
  endTime: z.union([z.string().datetime(), z.date(), z.string().min(1)]).optional(),
});

export const eventIdParamSchema = z.object({
  id: z.string().uuid('Invalid event ID format'),
});

// Task Schemas
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

// Project Schemas (Stage 1)
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

// Agent Schemas (Stage 2)
export const agentChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format').optional(),
  message: z.string().min(1, 'Message cannot be empty'),
});

export const pendingActionIdParamSchema = z.object({
  id: z.string().uuid('Invalid pending action ID format'),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
});

export * from './ai.schema.js';



