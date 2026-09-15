import { sql, eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { memories } from '../../../db/schema/index.js';
import { getAiProvider } from '../core/factory.js';
import { aiCostGuardService } from '../core/cost-guard.service.js';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';

export type MemoryType = 'preference' | 'decision' | 'project_fact';
export type MemoryStatus = 'active' | 'superseded' | 'archived';

export interface SaveMemoryOptions {
  checkContradiction?: boolean;
}

export interface SearchMemoryOptions {
  type?: MemoryType;
  topK?: number;
  maxDistance?: number;
  mode?: 'hybrid' | 'vector' | 'keyword';
}

export interface MemoryResult {
  id: string;
  type: MemoryType;
  content: string;
  distance: number;
  score: number;
  sourceRef: string | null;
  status: string;
  createdAt: Date;
}

export class MemoryService {
  /**
   * Persist a durable fact into the user's long-term semantic memory.
   * Handles deduplication and contradiction supersession.
   */
  async saveMemory(
    userId: string,
    type: MemoryType,
    content: string,
    sourceRef?: string,
    options: SaveMemoryOptions = {}
  ): Promise<{ id: string; type: MemoryType; content: string; status: string } | null> {
    if (!content || content.trim().length < 3) {
      logger.warn({ userId }, 'Memory content too short to persist');
      return null;
    }

    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      logger.warn('AI provider unavailable, skipping memory embedding');
      return null;
    }

    // Cost guard check — fail-safe, memory writes are non-blocking
    const circuit = await aiCostGuardService.checkCircuitBreaker(userId);
    if (circuit.isTripped) {
      logger.warn({ userId, reason: circuit.reason }, 'AI circuit breaker tripped, skipping memory write');
      return null;
    }

    try {
      const cleanContent = content.trim();
      const embedding = await provider.generateEmbedding(cleanContent, { dimensions: 768 });
      const vectorLiteral = `'[${embedding.join(',')}]'`;

      // 1. Deduplication check: near-exact match (< 0.12 distance)
      const existingNearDuplicates = await db
        .select({
          id: memories.id,
          distance: sql<number>`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`,
        })
        .from(memories)
        .where(
          and(
            eq(memories.userId, userId),
            eq(memories.type, type),
            eq(memories.status, 'active')
          )
        )
        .orderBy(sql`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`)
        .limit(1);

      if (
        existingNearDuplicates.length > 0 &&
        existingNearDuplicates[0].distance !== null &&
        Number(existingNearDuplicates[0].distance) < 0.12
      ) {
        const existingId = existingNearDuplicates[0].id;
        logger.info({ userId, existingId, distance: existingNearDuplicates[0].distance }, 'Deduplication match: updating existing memory timestamp');
        await db
          .update(memories)
          .set({ updatedAt: new Date() })
          .where(eq(memories.id, existingId));

        return {
          id: existingId,
          type,
          content: cleanContent,
          status: 'active',
        };
      }

      // 2. Contradiction supersession check
      let supersededId: string | undefined;
      if (options.checkContradiction !== false) {
        const candidateToSupersede = await db
          .select({
            id: memories.id,
            content: memories.content,
            distance: sql<number>`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`,
          })
          .from(memories)
          .where(
            and(
              eq(memories.userId, userId),
              eq(memories.type, type),
              eq(memories.status, 'active')
            )
          )
          .orderBy(sql`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`)
          .limit(1);

        if (
          candidateToSupersede.length > 0 &&
          candidateToSupersede[0].distance !== null &&
          Number(candidateToSupersede[0].distance) < 0.38
        ) {
          supersededId = candidateToSupersede[0].id;
        }
      }

      // 3. Insert new active memory
      const [inserted] = await db
        .insert(memories)
        .values({
          userId,
          type,
          content: cleanContent,
          sourceRef: sourceRef || 'explicit_user_request',
          embedding,
          status: 'active',
        })
        .returning({ id: memories.id });

      // If superseding an older conflicting memory, update old status
      if (supersededId && inserted?.id) {
        await db
          .update(memories)
          .set({
            status: 'superseded',
            supersededBy: inserted.id,
            updatedAt: new Date(),
          })
          .where(eq(memories.id, supersededId));

        logger.info({ userId, supersededId, newId: inserted.id }, 'Superseded older conflicting memory');
      }

      return {
        id: inserted.id,
        type,
        content: cleanContent,
        status: 'active',
      };
    } catch (err: unknown) {
      const error = toError(err);
      logger.warn({ err: error.message, userId }, 'Non-fatal error saving semantic memory');
      return null;
    }
  }

  /**
   * Search long-term memory using hybrid retrieval (Dense pgvector + Sparse tsvector RRF).
   */
  async searchMemory(
    userId: string,
    query: string,
    opts: SearchMemoryOptions = {}
  ): Promise<MemoryResult[]> {
    if (!query || query.trim().length === 0) return [];

    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      logger.warn('AI provider unavailable for memory retrieval');
      return [];
    }

    const topK = opts.topK ?? 3;
    const maxDistance = opts.maxDistance ?? 0.78;
    const mode = opts.mode ?? 'hybrid';
    const cleanQuery = query.trim();

    try {
      const queryEmbedding = await provider.generateEmbedding(cleanQuery, { dimensions: 768 });
      const vectorLiteral = `'[${queryEmbedding.join(',')}]'`;

      // 1. Dense Vector Search Branch
      const denseConditions = [
        eq(memories.userId, userId),
        eq(memories.status, 'active'),
      ];
      if (opts.type) {
        denseConditions.push(eq(memories.type, opts.type));
      }

      const denseRows = await db
        .select({
          id: memories.id,
          type: memories.type,
          content: memories.content,
          sourceRef: memories.sourceRef,
          status: memories.status,
          createdAt: memories.createdAt,
          distance: sql<number>`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`,
        })
        .from(memories)
        .where(and(...denseConditions))
        .orderBy(sql`${memories.embedding} <=> ${sql.raw(vectorLiteral)}::vector`)
        .limit(topK * 2);

      // Filter by max distance cutoff
      const validDenseRows = denseRows.filter(
        (r) => r.distance !== null && Number(r.distance) <= maxDistance
      );

      if (mode === 'vector' || validDenseRows.length === 0) {
        const results: MemoryResult[] = validDenseRows.slice(0, topK).map((r) => ({
          id: r.id,
          type: r.type as MemoryType,
          content: r.content,
          distance: Number(r.distance),
          score: 1 / (1 + Number(r.distance)),
          sourceRef: r.sourceRef,
          status: r.status,
          createdAt: r.createdAt,
        }));

        this.recordAccessAsync(results.map((r) => r.id));
        return results;
      }

      // 2. Sparse Keyword Search Branch (tsvector @@ plainto_tsquery)
      let sparseRows: Array<{
        id: string;
        type: string;
        content: string;
        sourceRef: string | null;
        status: string;
        createdAt: Date;
        rank: number;
      }> = [];

      try {
        const sparseConditions = [
          eq(memories.userId, userId),
          eq(memories.status, 'active'),
          sql`to_tsvector('english', ${memories.content}) @@ plainto_tsquery('english', ${cleanQuery})`,
        ];
        if (opts.type) {
          sparseConditions.push(eq(memories.type, opts.type));
        }

        sparseRows = await db
          .select({
            id: memories.id,
            type: memories.type,
            content: memories.content,
            sourceRef: memories.sourceRef,
            status: memories.status,
            createdAt: memories.createdAt,
            rank: sql<number>`ts_rank(to_tsvector('english', ${memories.content}), plainto_tsquery('english', ${cleanQuery}))`,
          })
          .from(memories)
          .where(and(...sparseConditions))
          .orderBy(desc(sql`ts_rank(to_tsvector('english', ${memories.content}), plainto_tsquery('english', ${cleanQuery}))`))
          .limit(topK * 2);
      } catch (sparseErr: unknown) {
        logger.warn({ err: toError(sparseErr).message }, 'Sparse keyword search fallback to pure vector');
      }

      // 3. Reciprocal Rank Fusion (RRF) with constant k=60
      const k = 60;
      const scoreMap = new Map<string, { item: typeof denseRows[0]; rrfScore: number; distance: number }>();

      // Dense ranking
      validDenseRows.forEach((item, index) => {
        const denseScore = 1 / (k + (index + 1));
        scoreMap.set(item.id, {
          item,
          rrfScore: denseScore,
          distance: Number(item.distance),
        });
      });

      // Sparse ranking fusion
      sparseRows.forEach((item, index) => {
        const sparseScore = 1 / (k + (index + 1));
        const existing = scoreMap.get(item.id);
        if (existing) {
          existing.rrfScore += sparseScore;
        } else {
          scoreMap.set(item.id, {
            item: {
              id: item.id,
              type: item.type,
              content: item.content,
              sourceRef: item.sourceRef,
              status: item.status,
              createdAt: item.createdAt,
              distance: 0.5, // Default mid-range semantic distance for pure keyword matches
            },
            rrfScore: sparseScore,
            distance: 0.5,
          });
        }
      });

      // Sort by RRF score descending
      const sorted = Array.from(scoreMap.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .slice(0, topK);

      const finalResults: MemoryResult[] = sorted.map(({ item, rrfScore, distance }) => ({
        id: item.id,
        type: item.type as MemoryType,
        content: item.content,
        distance,
        score: rrfScore,
        sourceRef: item.sourceRef,
        status: item.status,
        createdAt: item.createdAt,
      }));

      // Async access tracking
      this.recordAccessAsync(finalResults.map((r) => r.id));

      return finalResults;
    } catch (err: unknown) {
      const error = toError(err);
      logger.warn({ err: error.message, query }, 'Failed to search semantic memory');
      return [];
    }
  }

  /**
   * Delete or archive a memory ensuring strict tenant boundary.
   */
  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(memories)
        .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
        .returning({ id: memories.id });

      return result.length > 0;
    } catch (err: unknown) {
      const error = toError(err);
      logger.error({ err: error.message, userId, memoryId }, 'Failed to delete memory');
      return false;
    }
  }

  /**
   * List active memories for inspection or management UI.
   */
  async listMemories(
    userId: string,
    opts: { type?: MemoryType; status?: MemoryStatus; limit?: number } = {}
  ): Promise<Array<{ id: string; type: MemoryType; content: string; sourceRef: string | null; createdAt: Date }>> {
    const conditions = [eq(memories.userId, userId)];
    conditions.push(eq(memories.status, opts.status ?? 'active'));
    if (opts.type) {
      conditions.push(eq(memories.type, opts.type));
    }

    const rows = await db
      .select({
        id: memories.id,
        type: memories.type,
        content: memories.content,
        sourceRef: memories.sourceRef,
        createdAt: memories.createdAt,
      })
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.createdAt))
      .limit(opts.limit ?? 50);

    return rows.map((r) => ({
      ...r,
      type: r.type as MemoryType,
    }));
  }

  /**
   * Asynchronously increments access count without blocking retrieval.
   */
  private recordAccessAsync(memoryIds: string[]): void {
    if (memoryIds.length === 0) return;
    setImmediate(async () => {
      try {
        await db
          .update(memories)
          .set({
            accessCount: sql`${memories.accessCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(inArray(memories.id, memoryIds));
      } catch (err: unknown) {
        const error = toError(err);
        logger.debug({ err: error.message }, 'Failed to record memory access');
      }
    });
  }

  /**
   * Alias for searchMemory (plural compatibility)
   */
  async searchMemories(
    userId: string,
    query: string,
    options?: SearchMemoryOptions
  ) {
    return this.searchMemory(userId, query, options);
  }
}

export const memoryService = new MemoryService();
export const saveMemory = memoryService.saveMemory.bind(memoryService);
export const searchMemory = memoryService.searchMemory.bind(memoryService);
export const searchMemories = memoryService.searchMemories.bind(memoryService);
export const deleteMemory = memoryService.deleteMemory.bind(memoryService);
export const listMemories = memoryService.listMemories.bind(memoryService);
