import { describe, it, expect } from 'vitest';
import {
  clientCreateTaskSchema,
  clientUpdateTaskSchema,
  validateTaskForm,
  clientSendEmailSchema,
  validateEmailForm,
  clientAgentChatSchema,
  clientApproveActionSchema,
} from '../lib/schemas';

describe('Client Zod Form & Action Schemas', () => {
  describe('Task Schemas', () => {
    it('should validate valid task creation input', () => {
      const valid = {
        title: 'Review PR #42',
        description: 'Check security and test coverage',
        priority: 'high',
        estimatedMinutes: 30,
        importance: 0.8,
      };
      const res = validateTaskForm(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.title).toBe('Review PR #42');
        expect(res.data.priority).toBe('high');
      }
    });

    it('should reject empty title in task form validation', () => {
      const invalid = {
        title: '',
        priority: 'medium',
      };
      const res = validateTaskForm(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.title).toBeDefined();
        expect(res.errors.title).toContain('Task title is required');
      }
    });

    it('should reject invalid estimatedMinutes (< 1)', () => {
      const invalid = {
        title: 'Valid title',
        estimatedMinutes: 0,
      };
      const res = validateTaskForm(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.estimatedMinutes).toContain('Estimate must be at least 1 minute');
      }
    });

    it('should validate partial updates for clientUpdateTaskSchema', () => {
      const partialUpdate = {
        status: 'in_progress' as const,
        priority: 'low' as const,
      };
      const parsed = clientUpdateTaskSchema.safeParse(partialUpdate);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Email Schemas', () => {
    it('should validate complete email send input', () => {
      const valid = {
        to: 'colleague@example.com',
        subject: 'Weekly Status Report',
        body: 'Here is the summary of this week...',
      };
      const res = validateEmailForm(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.to).toBe('colleague@example.com');
      }
    });

    it('should reject empty recipient in email form validation', () => {
      const invalid = {
        to: '',
        subject: 'No recipient',
      };
      const res = validateEmailForm(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.to).toBeDefined();
        expect(res.errors.to).toContain('Recipient email is required');
      }
    });
  });

  describe('Agent & HITL Schemas', () => {
    it('should validate agent chat message within size constraints', () => {
      const valid = {
        message: 'Reschedule my 2 PM meeting to 3 PM',
        sessionId: 'a0000000-0000-4000-8000-000000000001',
      };
      const parsed = clientAgentChatSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject empty chat message', () => {
      const invalid = {
        message: '',
      };
      const parsed = clientAgentChatSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should require valid UUID for pending action approval', () => {
      const valid = {
        actionId: 'b0000000-0000-4000-8000-000000000002',
        idempotencyKey: 'idem-key-123',
      };
      expect(clientApproveActionSchema.safeParse(valid).success).toBe(true);

      const invalid = {
        actionId: 'invalid-not-a-uuid',
      };
      expect(clientApproveActionSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
