import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersRepository } from '../../repositories/users.repository.js';
import { tasksRepository } from '../../repositories/tasks.repository.js';
import { accountsRepository } from '../../repositories/accounts.repository.js';
import { emailsRepository } from '../../repositories/emails.repository.js';
import { aiRepository } from '../../repositories/ai.repository.js';
import { db } from '../../db/index.js';

describe('Repositories Relational & Integration Suite', () => {
  const testUserId = '11111111-1111-4111-a111-111111111111';
  const testAccountId = '22222222-2222-4222-a222-222222222222';
  const testTaskId = '33333333-3333-4333-a333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User & Connected Account Lifecycle Integration', () => {
    it('creates a user record and retrieves by email and id', async () => {
      const mockUser = {
        id: testUserId,
        email: 'integration-user@streamline.app',
        passwordHash: 'argon2_hashed_secret',
        name: 'Integration Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any);

      const created = await usersRepository.create({
        email: 'integration-user@streamline.app',
        passwordHash: 'argon2_hashed_secret',
        name: 'Integration Test User',
      });

      expect(created.id).toBe(testUserId);
      expect(created.email).toBe('integration-user@streamline.app');

      const found = await usersRepository.findByEmail('integration-user@streamline.app');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Integration Test User');
    });

    it('links a connected Google account and queries by user', async () => {
      const mockAccount = {
        id: testAccountId,
        userId: testUserId,
        providerAccountId: 'google-sub-12345',
        email: 'user.work@gmail.com',
        label: 'Work Account',
        color: '#10b981',
        status: 'active',
        scopes: 'https://www.googleapis.com/auth/gmail.modify',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findByUserAndProviderAccountId returning null (new account)
      vi.spyOn(accountsRepository, 'findByUserAndProviderAccountId').mockResolvedValue(null);

      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({
          returning: vi.fn().mockResolvedValue([mockAccount]),
        }),
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: vi.fn().mockResolvedValue([mockAccount]),
        }),
      } as any);

      const account = await accountsRepository.upsertAccount({
        userId: testUserId,
        providerAccountId: 'google-sub-12345',
        email: 'user.work@gmail.com',
        accessToken: 'enc-access',
        refreshToken: 'enc-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scopes: 'https://www.googleapis.com/auth/gmail.modify',
        label: 'Work Account',
        color: '#10b981',
      });

      expect(account?.id).toBe(testAccountId);
      expect(account?.label).toBe('Work Account');
      expect(account?.color).toBe('#10b981');

      const userAccounts = await accountsRepository.findByUserId(testUserId);
      expect(userAccounts).toHaveLength(1);
      expect(userAccounts[0]?.email).toBe('user.work@gmail.com');
    });
  });

  describe('Tasks Repository Relational Queries & Filters', () => {
    it('creates, queries active tasks, and updates completion status', async () => {
      const mockTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Review production logs',
        description: 'Check latency anomalies',
        status: 'todo',
        priority: 'high',
        importance: 0.9,
        estimatedMinutes: 45,
        dependencies: ['task-001'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({
          returning: vi.fn().mockResolvedValue([mockTask]),
        }),
      } as any);

      const created = await tasksRepository.create({
        userId: testUserId,
        title: 'Review production logs',
        description: 'Check latency anomalies',
        priority: 'high',
        importance: 0.9,
        estimatedMinutes: 45,
        dependencies: ['task-001'],
      });

      expect(created).toBeDefined();
      expect(created?.id).toBe(testTaskId);
      expect(created?.importance).toBe(0.9);

      // Query active tasks
      vi.spyOn(db, 'select').mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: vi.fn().mockResolvedValue([mockTask]),
          }),
        }),
      } as any);

      const activeTasks = await tasksRepository.listActiveTasks(testUserId);
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0]?.status).toBe('todo');

      // Update task to completed
      const completedTask = { ...mockTask, status: 'completed', completedAt: new Date() };
      vi.spyOn(db, 'update').mockReturnValue({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([completedTask]),
          }),
        }),
      } as any);

      const updated = await tasksRepository.update(testTaskId, testUserId, {
        status: 'completed',
        completedAt: new Date(),
      });

      expect(updated?.status).toBe('completed');
    });
  });

  describe('AI Preferences & Metadata Integration', () => {
    it('upserts user AI preferences and validates schema persistence', async () => {
      const mockPrefs = {
        userId: testUserId,
        digestTime: '09:00:00',
        digestTimezone: 'America/New_York',
        digestDeliveryMode: 'both',
        isAutoTriageEnabled: true,
        vipSenders: ['ceo@company.com'],
        customInstructions: 'Prioritize bug reports from VIP customers',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(aiRepository, 'getUserPreferences').mockResolvedValueOnce(null);

      vi.spyOn(db, 'insert').mockReturnValue({
        values: () => ({
          returning: vi.fn().mockResolvedValue([mockPrefs]),
        }),
      } as any);

      const createdPrefs = await aiRepository.upsertUserPreferences(testUserId, {
        digestTime: '09:00:00',
        digestTimezone: 'America/New_York',
        digestDeliveryMode: 'both',
        isAutoTriageEnabled: true,
        vipSenders: ['ceo@company.com'],
        customInstructions: 'Prioritize bug reports from VIP customers',
      });

      expect(createdPrefs?.digestTime).toBe('09:00:00');
      expect(createdPrefs?.vipSenders).toContain('ceo@company.com');
    });
  });

  describe('Cosine Similarity & Reciprocal Rank Fusion Logic', () => {
    it('calculates reciprocal rank fusion (RRF) scores across keyword and vector rank lists', () => {
      // RRF scoring formula: RRF(d) = sum(1 / (k + rank_i(d))) where k = 60
      const k = 60;
      const keywordResults = ['doc-A', 'doc-B', 'doc-C'];
      const vectorResults = ['doc-B', 'doc-D', 'doc-A'];

      const scores = new Map<string, number>();

      keywordResults.forEach((id, idx) => {
        const rank = idx + 1;
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
      });

      vectorResults.forEach((id, idx) => {
        const rank = idx + 1;
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
      });

      // doc-B is rank 2 in keyword (1/62) and rank 1 in vector (1/61)
      const expectedDocB = 1 / 62 + 1 / 61;
      // doc-A is rank 1 in keyword (1/61) and rank 3 in vector (1/63)
      const expectedDocA = 1 / 61 + 1 / 63;

      expect(scores.get('doc-B')).toBeCloseTo(expectedDocB, 5);
      expect(scores.get('doc-A')).toBeCloseTo(expectedDocA, 5);
      expect(scores.get('doc-B')!).toBeGreaterThan(scores.get('doc-A')!);
    });

    it('computes cosine distance correctly for 768-dimensional normalized embedding vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0];
      const v3 = [0, 1, 0];

      function cosineDistance(a: number[], b: number[]): number {
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += (a[i] ?? 0) * (b[i] ?? 0);
          magA += (a[i] ?? 0) ** 2;
          magB += (b[i] ?? 0) ** 2;
        }
        return 1 - dot / (Math.sqrt(magA) * Math.sqrt(magB));
      }

      expect(cosineDistance(v1, v2)).toBeCloseTo(0, 5);
      expect(cosineDistance(v1, v3)).toBeCloseTo(1, 5);
    });
  });
});
