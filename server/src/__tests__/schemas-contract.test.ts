import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema, taskIdParamSchema } from '../schemas/tasks.schema.js';
import {
  agentChatSchema,
  pendingActionIdParamSchema,
  sessionIdParamSchema,
  memoryIdParamSchema,
} from '../schemas/agent.schema.js';
import {
  sendEmailSchema,
  emailIdParamSchema,
  markEmailReadSchema,
  starEmailSchema,
  updateCategorySchema,
} from '../schemas/emails.schema.js';
import { updateAccountSchema, accountIdParamSchema } from '../schemas/accounts.schema.js';
import { createEventSchema, updateEventSchema, eventIdParamSchema } from '../schemas/events.schema.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import {
  updateAiPreferencesSchema,
  convertRadarTaskSchema,
  dismissRadarTaskSchema,
  draftReplySchema,
  threadIdParamSchema,
} from '../schemas/ai.schema.js';
import { createProjectSchema, updateProjectSchema, projectIdParamSchema } from '../schemas/projects.schema.js';

describe('Zod Schema Contract & Boundary Fuzzing Suite', () => {
  const validUuid = '12345678-1234-4234-8234-123456789abc';

  describe('Tasks Schema Contracts', () => {
    it('successfully parses valid task creation payload with defaults', () => {
      const result = createTaskSchema.safeParse({
        title: 'Review production metrics',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Review production metrics');
        expect(result.data.priority).toBe('medium');
      }
    });

    it('rejects empty title with specific validation message', () => {
      const result = createTaskSchema.safeParse({
        title: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['title']);
        expect(result.error.issues[0]?.message).toBe('Task title is required');
      }
    });

    it('validates importance bounds (0 to 1) and estimatedMinutes (>=1)', () => {
      const invalidImportance = createTaskSchema.safeParse({
        title: 'Test',
        importance: 1.5,
      });
      expect(invalidImportance.success).toBe(false);

      const invalidMinutes = createTaskSchema.safeParse({
        title: 'Test',
        estimatedMinutes: 0,
      });
      expect(invalidMinutes.success).toBe(false);
    });

    it('validates updateTaskSchema with partial fields and status enum', () => {
      const validUpdate = updateTaskSchema.safeParse({
        status: 'in_progress',
        priority: 'high',
      });
      expect(validUpdate.success).toBe(true);

      const invalidStatus = updateTaskSchema.safeParse({
        status: 'archived_invalid',
      });
      expect(invalidStatus.success).toBe(false);
    });

    it('validates taskIdParamSchema requires valid UUID', () => {
      expect(taskIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
      const invalid = taskIdParamSchema.safeParse({ id: 'not-a-uuid' });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Invalid task ID format');
      }
    });
  });

  describe('Agent & Shield Schema Contracts', () => {
    it('validates agent chat payload with empty message rejection', () => {
      const valid = agentChatSchema.safeParse({
        message: 'Hello copilot',
        sessionId: validUuid,
      });
      expect(valid.success).toBe(true);

      const emptyMsg = agentChatSchema.safeParse({
        message: '',
      });
      expect(emptyMsg.success).toBe(false);
    });

    it('validates pendingActionIdParamSchema and memoryIdParamSchema', () => {
      expect(pendingActionIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
      expect(pendingActionIdParamSchema.safeParse({ id: 'invalid-id' }).success).toBe(false);
      expect(memoryIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
      expect(sessionIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
    });
  });

  describe('Emails Schema Contracts', () => {
    it('parses sendEmailSchema with defaults for subject and body', () => {
      const result = sendEmailSchema.safeParse({
        to: 'colleague@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe('');
        expect(result.data.body).toBe('');
      }
    });

    it('rejects missing recipient in sendEmailSchema', () => {
      const result = sendEmailSchema.safeParse({
        subject: 'Missing to',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['to']);
      }
    });

    it('validates attachment structure and category enum', () => {
      const validAttachment = sendEmailSchema.safeParse({
        to: 'test@example.com',
        attachments: [{ filename: 'report.pdf', mimeType: 'application/pdf', size: 1024 }],
      });
      expect(validAttachment.success).toBe(true);

      const validCategory = updateCategorySchema.safeParse({ category: 'promotions' });
      expect(validCategory.success).toBe(true);

      const invalidCategory = updateCategorySchema.safeParse({ category: 'unknown_cat' });
      expect(invalidCategory.success).toBe(false);
    });
  });

  describe('Accounts & Events Schema Contracts', () => {
    it('validates account hex color regex', () => {
      const validColor = updateAccountSchema.safeParse({ color: '#3b82f6' });
      expect(validColor.success).toBe(true);

      const invalidColor = updateAccountSchema.safeParse({ color: 'rgb(255,0,0)' });
      expect(invalidColor.success).toBe(false);
    });

    it('validates createEventSchema required fields and date handling', () => {
      const validEvent = createEventSchema.safeParse({
        title: 'Team Sync',
        startTime: '2026-09-17T10:00:00.000Z',
        endTime: '2026-09-17T11:00:00.000Z',
      });
      expect(validEvent.success).toBe(true);

      const missingTime = createEventSchema.safeParse({
        title: 'Team Sync',
      });
      expect(missingTime.success).toBe(false);
    });
  });

  describe('Auth & AI Preferences Schema Contracts', () => {
    it('validates register and login email formatting', () => {
      expect(registerSchema.safeParse({ email: 'user@example.com', password: 'Password123' }).success).toBe(true);
      expect(registerSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
      expect(loginSchema.safeParse({ email: 'user@domain.com' }).success).toBe(true);
    });

    it('validates AI digestTime format (HH:MM / HH:MM:SS)', () => {
      const validTime = updateAiPreferencesSchema.safeParse({ digestTime: '08:30' });
      expect(validTime.success).toBe(true);

      const invalidTime = updateAiPreferencesSchema.safeParse({ digestTime: '25:99' });
      expect(invalidTime.success).toBe(false);
    });

    it('validates radar task conversion schema', () => {
      const validRadar = convertRadarTaskSchema.safeParse({
        emailId: validUuid,
        taskId: 'task-101',
        title: 'Schedule quarterly review',
        priority: 'high',
      });
      expect(validRadar.success).toBe(true);

      const invalidEmailId = convertRadarTaskSchema.safeParse({
        emailId: 'not-uuid',
        taskId: 'task-101',
        title: 'Schedule review',
      });
      expect(invalidEmailId.success).toBe(false);
    });

    it('validates draftReplySchema tone enum and defaults', () => {
      const valid = draftReplySchema.safeParse({
        tone: 'counter_propose',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.tone).toBe('counter_propose');
        expect(valid.data.replyType).toBe('reply');
      }

      const invalidTone = draftReplySchema.safeParse({
        tone: 'aggressive_invalid',
      });
      expect(invalidTone.success).toBe(false);
    });

    it('validates threadIdParamSchema requires non-empty string', () => {
      expect(threadIdParamSchema.safeParse({ threadId: 'thread-123' }).success).toBe(true);
      expect(threadIdParamSchema.safeParse({ threadId: '' }).success).toBe(false);
    });
  });

  describe('Projects Schema Contracts', () => {
    it('validates project creation and color formatting', () => {
      const valid = createProjectSchema.safeParse({
        name: 'Infrastructure Upgrade',
        color: '#10b981',
      });
      expect(valid.success).toBe(true);

      const missingName = createProjectSchema.safeParse({
        color: '#10b981',
      });
      expect(missingName.success).toBe(false);

      expect(projectIdParamSchema.safeParse({ id: validUuid }).success).toBe(true);
    });
  });
});
