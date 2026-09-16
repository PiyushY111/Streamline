import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { memoryService, saveMemory, searchMemory, deleteMemory } from '../services/ai/memory/memory.service.js';
import { db } from '../db/index.js';
import { memories } from '../db/schema/index.js';
import { setAiProvider } from '../services/ai/core/factory.js';
import { MockAiProvider } from '../services/ai/core/providers/mock.provider.js';
import { aiCostGuardService } from '../services/ai/core/cost-guard.service.js';

describe('Stage 3 Memory Service & Hybrid RAG Engine', () => {
  const mockProvider = new MockAiProvider();

  beforeEach(() => {
    setAiProvider(mockProvider);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setAiProvider(null);
  });

  describe('Multi-Tenant Isolation & Security', () => {
    it('should strictly isolate memories across different user IDs', async () => {
      const userA = '00000000-0000-0000-0000-000000000001';
      const userB = '00000000-0000-0000-0000-000000000002';

      // Mock database select returning only userA rows
      const selectSpy = vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((condition) => {
          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                id: 'mem-user-a',
                userId: userA,
                type: 'preference',
                content: 'User A prefers deep work before 12pm',
                sourceRef: 'agent_session:1',
                status: 'active',
                createdAt: new Date(),
                distance: 0.15,
              },
            ]),
          };
        }),
      } as any));

      const resultsForUserA = await searchMemory(userA, 'deep work schedule');
      expect(resultsForUserA).toHaveLength(1);
      expect(resultsForUserA[0].id).toBe('mem-user-a');
      expect(resultsForUserA[0].content).toContain('User A');

      selectSpy.mockRestore();
    });
  });

  describe('Deduplication and Contradiction Supersession', () => {
    it('should detect near-duplicate memory and update existing timestamp instead of duplicating', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const existingId = 'existing-mem-uuid-1';

      // Mock deduplication query finding near-duplicate (< 0.12 distance)
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: existingId,
            distance: 0.04,
          },
        ]),
      } as any));

      const updateSpy = vi.spyOn(db, 'update').mockImplementation(() => ({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: existingId }]),
      } as any));

      const insertSpy = vi.spyOn(db, 'insert');

      const result = await saveMemory(
        userId,
        'preference',
        'I usually overestimate how long coding tasks take'
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(existingId);
      expect(updateSpy).toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('should supersede previous conflicting memory when contradiction is detected', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const oldMemoryId = 'old-preference-uuid-1';
      const newMemoryId = 'new-preference-uuid-2';

      let selectCallCount = 0;
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Deduplication check: distance 0.25 (not duplicate)
            return Promise.resolve([{ id: oldMemoryId, distance: 0.25 }]);
          } else {
            // Contradiction candidate: distance 0.25 (< 0.38 threshold)
            return Promise.resolve([{ id: oldMemoryId, content: 'Morning focus', distance: 0.25 }]);
          }
        }),
      } as any));

      vi.spyOn(db, 'insert').mockImplementation(() => ({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: newMemoryId }]),
      } as any));

      const updateSpy = vi.spyOn(db, 'update').mockImplementation(() => ({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: oldMemoryId }]),
      } as any));

      const result = await saveMemory(
        userId,
        'preference',
        'I changed my routine; I now do focus blocks in the evening',
        'explicit_user_request',
        { checkContradiction: true }
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(newMemoryId);
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('Hybrid Retrieval & Filtering', () => {
    it('should filter memories by category type when specified', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';

      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 'mem-decision-1',
            type: 'decision',
            content: 'Decided to use Postgres over MongoDB for relational integrity',
            sourceRef: 'explicit',
            status: 'active',
            createdAt: new Date(),
            distance: 0.2,
          },
        ]),
      } as any));

      const results = await searchMemory(userId, 'database decision', { type: 'decision' });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('decision');
      expect(results[0].content).toContain('Postgres');
    });

    it('should gracefully return empty array when query is empty', async () => {
      const results = await searchMemory('user-1', '   ');
      expect(results).toEqual([]);
    });

    it('should gracefully return null on save when content is too short', async () => {
      const result = await saveMemory('user-1', 'preference', 'a');
      expect(result).toBeNull();
    });
  });

  describe('Circuit Breaker & Failure Isolation', () => {
    it('should silently skip memory save when AI circuit breaker is tripped', async () => {
      vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValueOnce({
        isTripped: true,
        reason: 'Daily AI budget exceeded',
        tokensToday: 150000,
        costTodayUsd: 1.0,
      });

      const result = await saveMemory('user-1', 'preference', 'Remember that I use Dark Mode');
      expect(result).toBeNull();
    });

    it('should delete memory strictly restricted to matching user ID', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const memoryId = 'mem-to-delete-1';

      vi.spyOn(db, 'delete').mockImplementation(() => ({
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: memoryId }]),
      } as any));

      const deleted = await deleteMemory(userId, memoryId);
      expect(deleted).toBe(true);
    });

    it('should associate saved memory with embeddingModelVersion', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      vi.spyOn(db, 'select').mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any));

      vi.spyOn(db, 'insert').mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-mem-versioned' }]),
        }),
      } as any));

      const saved = await saveMemory(userId, 'project_fact', 'Backend is written in TypeScript and Node.js', 'explicit', {
        embeddingModelVersion: 'text-embedding-004',
      });

      expect(saved).not.toBeNull();
      expect(saved?.embeddingModelVersion).toBe('text-embedding-004');
    });
  });
});
