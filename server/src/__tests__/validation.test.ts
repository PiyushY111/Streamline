import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  updateAccountSchema,
  sendEmailSchema,
  markEmailReadSchema,
  starEmailSchema,
  updateCategorySchema,
  createEventSchema,
  updateEventSchema,
  createTaskSchema,
  updateTaskSchema,
} from '../schemas/index.js';

describe('Zod Request Validation Schemas', () => {
  describe('Auth Schemas', () => {
    it('should validate correct registration payload', () => {
      const valid = { email: 'user@example.com', password: 'password123', name: 'Alex' };
      expect(registerSchema.parse(valid)).toEqual(valid);
    });

    it('should reject invalid email in registration', () => {
      expect(() => registerSchema.parse({ email: 'not-an-email', password: '123' })).toThrow();
    });

    it('should validate login payload with email', () => {
      const valid = { email: 'user@example.com', password: 'password123' };
      expect(loginSchema.parse(valid)).toEqual(valid);
    });
  });

  describe('Account Schemas', () => {
    it('should validate account update with hex color', () => {
      const valid = { label: 'Work Inbox', color: '#3b82f6' };
      expect(updateAccountSchema.parse(valid)).toEqual(valid);
    });

    it('should reject invalid hex color', () => {
      expect(() => updateAccountSchema.parse({ color: 'blue' })).toThrow();
      expect(() => updateAccountSchema.parse({ color: '#12345' })).toThrow();
    });
  });

  describe('Email Schemas', () => {
    it('should validate correct send email payload', () => {
      const valid = {
        to: 'recipient@example.com',
        subject: 'Weekly Report',
        body: 'Here is the weekly report.',
      };
      const parsed = sendEmailSchema.parse(valid);
      expect(parsed.to).toBe('recipient@example.com');
    });

    it('should reject empty recipient in send email', () => {
      expect(() => sendEmailSchema.parse({ to: '', subject: 'Hi' })).toThrow();
    });

    it('should validate email categories', () => {
      expect(updateCategorySchema.parse({ category: 'promotions' })).toEqual({ category: 'promotions' });
      expect(updateCategorySchema.parse({ category: 'primary' })).toEqual({ category: 'primary' });
      expect(() => updateCategorySchema.parse({ category: 'invalid_cat' })).toThrow();
    });
  });

  describe('Event & Task Schemas', () => {
    it('should validate create event payload', () => {
      const valid = {
        title: 'Team Sync',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        location: 'Zoom',
      };
      const parsed = createEventSchema.parse(valid);
      expect(parsed.title).toBe('Team Sync');
    });

    it('should reject create event without title', () => {
      expect(() =>
        createEventSchema.parse({
          title: '',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        })
      ).toThrow();
    });

    it('should validate create task payload', () => {
      const valid = {
        title: 'Deploy to Staging',
        priority: 'high' as const,
        description: 'Verify migrations',
      };
      const parsed = createTaskSchema.parse(valid);
      expect(parsed.priority).toBe('high');
    });

    it('should reject task with invalid priority', () => {
      expect(() =>
        createTaskSchema.parse({
          title: 'Task',
          priority: 'urgent' as any,
        })
      ).toThrow();
    });
  });
});
