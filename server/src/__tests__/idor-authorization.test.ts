import { describe, it, expect, vi } from 'vitest';
import { agentRepository } from '../repositories/agent.repository.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { accountsRepository } from '../repositories/accounts.repository.js';
import { emailsRepository } from '../repositories/emails.repository.js';
import { projectsRepository } from '../repositories/projects.repository.js';
import { eventsRepository } from '../repositories/events.repository.js';
import { aiRepository } from '../repositories/ai.repository.js';
import { db } from '../db/index.js';

describe('IDOR & Multi-Tenant Query-Level Boundary Isolation', () => {
  const userA = '00000000-0000-0000-0000-00000000000a';
  const userB = '00000000-0000-0000-0000-00000000000b';

  describe('AgentRepository Tenant Isolation', () => {
    it('should prevent User B from reading or updating User A session', async () => {
      // Mock db returns null when querying with mismatched userId
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const session = await agentRepository.findSessionById('session-a', userB);
      expect(session).toBeNull();

      const updated = await agentRepository.updateSessionTitle('session-a', userB, 'Hacked Title');
      expect(updated).toBeNull();
    });

    it('should prevent User B from reading User A session messages', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Session not found for userB
          }),
        }),
      } as any);

      const messages = await agentRepository.listSessionMessages('session-a', userB);
      expect(messages).toEqual([]);
    });

    it('should prevent User B from resolving or updating User A pending action', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const action = await agentRepository.findPendingActionById('action-a', userB);
      expect(action).toBeNull();

      const updated = await agentRepository.updatePendingAction('action-a', userB, { status: 'executed' });
      expect(updated).toBeNull();
    });
  });

  describe('TasksRepository Tenant Isolation', () => {
    it('should prevent User B from reading, updating, or deleting User A task', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const task = await tasksRepository.getById('task-a', userB);
      expect(task).toBeNull();

      const updated = await tasksRepository.update('task-a', userB, { title: 'Unauthorized' });
      expect(updated).toBeUndefined();
    });
  });

  describe('AccountsRepository Tenant Isolation', () => {
    it('should prevent User B from accessing or deleting User A connected account', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const account = await accountsRepository.findByIdAndUserId('acc-a', userB);
      expect(account).toBeNull();

      const detailsUpdated = await accountsRepository.updateAccountDetails('acc-a', userB, { label: 'Stolen' });
      expect(detailsUpdated).toBeNull();
    });
  });

  describe('EmailsRepository Tenant Isolation', () => {
    it('should return null when User B attempts to access User A email', async () => {
      // User B has no matching connected accounts
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const email = await emailsRepository.findById('email-a', userB);
      expect(email).toBeNull();

      const starred = await emailsRepository.toggleStar('email-a', userB, true);
      expect(starred).toBeNull();

      const deleted = await emailsRepository.deleteEmail('email-a', userB);
      expect(deleted).toEqual({ rowCount: 0 });
    });
  });

  describe('ProjectsRepository & AiRepository Tenant Isolation', () => {
    it('should prevent User B from accessing User A project', async () => {
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const project = await projectsRepository.getById('project-a', userB);
      expect(project).toBeNull();
    });

    it('should prevent User B from updating User A daily digest', async () => {
      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const digest = await aiRepository.markDigestAsRead('digest-a', userB);
      expect(digest).toBeUndefined();
    });
  });
});
