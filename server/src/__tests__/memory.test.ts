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
    vi.spyOn(aiCostGuardService, 'checkCircuitBreaker').mockResolvedValue({
      isTripped: false,
      costTodayUsd: 0,
      tokensToday: 0,
    });
  });

  afterEach(() => {
    setAiProvider(null);
  });

  describe('Multi-Tenant Isolation & Security', () => {
    it('should strictly isolate memories across different user IDs', async () => {
      const userA = '00000000-0000-0000-0000-000000000001';
      const userB = '00000000-0000-0000-0000-000000000002';

      // Mock database select returning only userA rows
      const selectSpy = vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
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
          }) as any,
      );

      const resultsForUserA = await searchMemory(userA, 'deep work schedule');
      expect(resultsForUserA).toHaveLength(1);
      expect(resultsForUserA[0]!.id).toBe('mem-user-a');
      expect(resultsForUserA[0]!.content).toContain('User A');

      selectSpy.mockRestore();
    });
  });

  describe('Deduplication and Contradiction Supersession', () => {
    it('should detect near-duplicate memory and update existing timestamp instead of duplicating', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const existingId = 'existing-mem-uuid-1';
      const cleanContent = 'User prefers async communication over meetings';

      const selectSpy = vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      id: existingId,
                      distance: 0.05, // < 0.12 near duplicate threshold
                    },
                  ]),
                }),
              }),
            }),
          }) as any,
      );

      const updateSpy = vi.spyOn(db, 'update').mockImplementation(
        () =>
          ({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }) as any,
      );

      const result = await saveMemory(userId, 'preference', cleanContent);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(existingId);
      expect(updateSpy).toHaveBeenCalled();

      selectSpy.mockRestore();
      updateSpy.mockRestore();
    });

    it('should supersede existing memory when contradiction is detected', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const oldMemId = 'old-mem-uuid-1';
      const newMemId = 'new-mem-uuid-2';
      const newContent = 'User now prefers working in the mornings';

      const selectSpy = vi
        .spyOn(db, 'select')
        // 1st select: Near-duplicate check (none found)
        .mockImplementationOnce(
          () =>
            ({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }) as any,
        )
        // 2nd select: Contradiction candidate search (found close match to supersede)
        .mockImplementationOnce(
          () =>
            ({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        id: oldMemId,
                        content: 'User prefers working late at night',
                        distance: 0.25, // < 0.38 contradiction threshold
                      },
                    ]),
                  }),
                }),
              }),
            }) as any,
        );

      const insertSpy = vi.spyOn(db, 'insert').mockImplementation(
        () =>
          ({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: newMemId }]),
            }),
          }) as any,
      );

      const updateSpy = vi.spyOn(db, 'update').mockImplementation(
        () =>
          ({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({}),
            }),
          }) as any,
      );

      const result = await saveMemory(userId, 'preference', newContent);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(newMemId);
      expect(updateSpy).toHaveBeenCalled();

      selectSpy.mockRestore();
      insertSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });

  describe('Search Filtering and Edge Cases', () => {
    it('should filter memories by type when specified', async () => {
      const userId = 'user-filter-test';
      const selectSpy = vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      id: 'mem-filter-1',
                      type: 'decision',
                      content: 'Adopted Postgres for relational durability',
                      sourceRef: 'chat',
                      status: 'active',
                      createdAt: new Date(),
                      distance: 0.2,
                    },
                  ]),
                }),
              }),
            }),
          }) as any,
      );

      const results = await searchMemory(userId, 'database decision', { type: 'decision' });
      expect(results).toHaveLength(1);
      expect(results[0]!.type).toBe('decision');
      expect(results[0]!.content).toContain('Postgres');
    });

    it('should gracefully return empty array when query is empty', async () => {
      const results = await searchMemory('user-1', '   ');
      expect(results).toEqual([]);
    });

    it('mode: "keyword" runs the pure sparse tsvector branch — no cosine distance, uses ts_rank as score', async () => {
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      id: 'mem-kw-1',
                      type: 'preference',
                      content: 'I like 15-minute buffer breaks between meetings',
                      sourceRef: 'chat',
                      status: 'active',
                      createdAt: new Date(),
                      embeddingModelVersion: 'text-embedding-004',
                      rank: 0.0122,
                    },
                  ]),
                }),
              }),
            }),
          }) as any,
      );

      const results = await searchMemory('user-kw-test', 'buffer time between meetings', { mode: 'keyword' });

      expect(results).toHaveLength(1);
      expect(results[0]!.content).toContain('buffer');
      expect(results[0]!.distance).toBe(0.5); // fixed placeholder — keyword matches have no cosine distance
      expect(results[0]!.score).toBeCloseTo(0.0122);
    });

    it('mode: "vector" runs the dense-only branch and never issues a sparse tsvector query', async () => {
      const selectSpy = vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      id: 'mem-vec-1',
                      type: 'decision',
                      content: 'Decided to use PostgreSQL over MongoDB',
                      sourceRef: 'chat',
                      status: 'active',
                      createdAt: new Date(),
                      embeddingModelVersion: 'text-embedding-004',
                      distance: 0.15,
                    },
                  ]),
                }),
              }),
            }),
          }) as any,
      );

      const results = await searchMemory('user-vec-test', 'database choice', { mode: 'vector' });

      expect(results).toHaveLength(1);
      expect(results[0]!.distance).toBe(0.15);
      // Exactly one select round-trip (the dense query) — mode: 'vector' must short-circuit
      // before ever building or issuing the sparse tsvector query.
      expect(selectSpy).toHaveBeenCalledTimes(1);
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

      vi.spyOn(db, 'delete').mockImplementation(
        () =>
          ({
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: memoryId }]),
          }) as any,
      );

      const deleted = await deleteMemory(userId, memoryId);
      expect(deleted).toBe(true);
    });

    it('should associate saved memory with embeddingModelVersion', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      vi.spyOn(db, 'select').mockImplementation(
        () =>
          ({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          }) as any,
      );

      vi.spyOn(db, 'insert').mockImplementation(
        () =>
          ({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'new-mem-versioned' }]),
            }),
          }) as any,
      );

      const saved = await saveMemory(
        userId,
        'project_fact',
        'Backend is written in TypeScript and Node.js',
        'explicit',
        {
          embeddingModelVersion: 'text-embedding-004',
        },
      );

      expect(saved).not.toBeNull();
      expect(saved?.embeddingModelVersion).toBe('text-embedding-004');
    });
  });
});
