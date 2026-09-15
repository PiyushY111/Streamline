import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rerankerService } from '../services/ai/memory/reranker.service.js';
import { graphRAGService } from '../services/ai/memory/graph-rag.service.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../services/ai/core/factory.js', () => ({
  getAiProvider: vi.fn().mockReturnValue({
    isAvailable: () => true,
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.01)),
    generateStructuredJson: vi.fn().mockResolvedValue({
      entities: [
        { name: 'Sarah Chen', type: 'person', metadata: {} },
        { name: 'Q3 Budget', type: 'topic', metadata: {} },
      ],
      relations: [
        { from: 'Sarah Chen', to: 'Q3 Budget', relationType: 'discussed' },
      ],
    }),
  }),
}));

describe('Cross-Encoder Reranker Service', () => {
  it('should re-rank candidates using local scoring with temporal decay fallback', async () => {
    const candidates = [
      { id: '1', text: 'Sarah discussed the budget yesterday', sourceType: 'memory' as const, originalScore: 0.5, timestamp: new Date() },
      { id: '2', text: 'Lunch plans with Sarah', sourceType: 'memory' as const, originalScore: 0.5, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) },
      { id: '3', text: 'Unrelated notes about server deployment', sourceType: 'memory' as const, originalScore: 0.2 },
    ];

    const results = await rerankerService.rerank('Sarah budget', candidates, 2);

    expect(results.length).toBe(2);
    // First result should have highest relevance score due to query token matches
    expect(results[0].id).toBe('1');
    expect(results[0].confidencePct).toBeGreaterThan(50);
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });
});

describe('GraphRAG Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user graph nodes and edges', async () => {
    const mockEntities = [
      { id: 'ent-1', name: 'Alex', type: 'person', metadata: {} },
      { id: 'ent-2', name: 'Acme Corp', type: 'company', metadata: {} },
    ];
    const mockRelations = [
      { id: 'rel-1', fromEntityId: 'ent-1', toEntityId: 'ent-2', relationType: 'works_at', weight: 1.0 },
    ];

    (db.select as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockEntities),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRelations),
          }),
        }),
      });

    const graph = await graphRAGService.getUserGraphData('user-test-1');
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.nodes[0].name).toBe('Alex');
    expect(graph.edges[0].relationType).toBe('works_at');
  });
});
