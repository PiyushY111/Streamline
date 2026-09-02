import { describe, it, expect, vi, beforeEach } from 'vitest';
import { me, logout } from '../controllers/auth.controller.js';
import { convertRadarTask, dismissRadarTask, getPreferences } from '../controllers/ai.controller.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { aiRepository } from '../repositories/ai.repository.js';

describe('API Route Controllers Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth Controller Handlers', () => {
    it('should return 401 when calling me endpoint without authenticated user', async () => {
      const req: any = { user: null };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await me(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
    });

    it('should clear cookies on logout', async () => {
      const req: any = { user: { id: 'user-1' }, ip: '127.0.0.1' };
      const res: any = {
        clearCookie: vi.fn(),
        json: vi.fn(),
      };

      await logout(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith('session_token', { path: '/' });
      expect(res.clearCookie).toHaveBeenCalledWith('csrf_token', { path: '/' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('AI Controller Handlers', () => {
    it('should convert an AI Radar task into an official Streamline task', async () => {
      vi.spyOn(tasksRepository, 'create').mockResolvedValue({
        id: 'task-101',
        userId: 'user-1',
        title: 'Review Midterm Project Specification',
        priority: 'high',
        status: 'todo',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(aiRepository, 'updateRadarTaskStatus').mockResolvedValue(true as any);

      const req: any = {
        user: { id: 'user-1' },
        body: {
          emailId: 'email-202',
          taskId: 'task-raw-1',
          title: 'Review Midterm Project Specification',
          priority: 'high',
          dueDate: '2026-09-10T12:00:00.000Z',
        },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await convertRadarTask(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task created successfully from AI radar',
        })
      );
    });

    it('should dismiss an AI Radar task without creating a task', async () => {
      vi.spyOn(aiRepository, 'updateRadarTaskStatus').mockResolvedValue(true as any);

      const req: any = {
        user: { id: 'user-1' },
        body: { emailId: 'email-202', taskId: 'task-raw-1' },
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await dismissRadarTask(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should initialize and return default AI preferences if none exist', async () => {
      vi.spyOn(aiRepository, 'getUserPreferences').mockResolvedValue(null as any);
      vi.spyOn(aiRepository, 'upsertUserPreferences').mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        digestTime: '08:00:00',
        digestTimezone: 'UTC',
        digestDeliveryMode: 'in_app',
        isAutoTriageEnabled: true,
        vipSenders: [],
      } as any);

      const req: any = { user: { id: 'user-1' } };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await getPreferences(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ isAutoTriageEnabled: true }),
        })
      );
    });
  });
});
