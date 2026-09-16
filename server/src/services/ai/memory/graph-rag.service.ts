import { db } from '../../../db/index.js';
import { entities, entityRelations, memories } from '../../../db/schema/index.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { memoryService } from './memory.service.js';
import { rerankerService, RerankCandidate, RerankedResult } from './reranker.service.js';
import { getAiProvider } from '../core/factory.js';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: string;
  weight: number;
}

export interface GraphRAGResponse {
  query: string;
  anchorEntities: GraphNode[];
  traversedNodes: GraphNode[];
  traversedEdges: GraphEdge[];
  rerankedContext: RerankedResult[];
  formattedContextBlock: string;
  latencyMs: number;
}

export class GraphRAGService {
  /**
   * Get entire knowledge graph nodes and edges for visualization in the UI
   */
  public async getUserGraphData(userId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const rawEntities = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        metadata: entities.metadata,
      })
      .from(entities)
      .where(eq(entities.userId, userId))
      .limit(200);

    const rawRelations = await db
      .select({
        id: entityRelations.id,
        from: entityRelations.fromEntityId,
        to: entityRelations.toEntityId,
        relationType: entityRelations.relationType,
        weight: entityRelations.weight,
      })
      .from(entityRelations)
      .where(eq(entityRelations.userId, userId))
      .limit(300);

    return {
      nodes: rawEntities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        metadata: e.metadata || {},
      })),
      edges: rawRelations.map((r) => ({
        id: r.id,
        from: r.from,
        to: r.to,
        relationType: r.relationType,
        weight: r.weight,
      })),
    };
  }

  /**
   * Execute multi-hop GraphRAG retrieval with two-stage cross-encoder re-ranking
   */
  public async queryGraphRAG(userId: string, query: string): Promise<GraphRAGResponse> {
    const startTime = Date.now();
    logger.info({ userId, query }, 'Initiating GraphRAG retrieval pass...');

    // 1. Anchor Entity Discovery (Vector Similarity + Text Match)
    const provider = getAiProvider();
    let queryEmbedding: number[] | null = null;
    if (provider && provider.isAvailable()) {
      try {
        queryEmbedding = await provider.generateEmbedding(query, { dimensions: 768 });
      } catch {}
    }

    const anchorCandidates = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        metadata: entities.metadata,
        distance: queryEmbedding
          ? sql<number>`${entities.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'`)}::vector`
          : sql<number>`1.0`,
      })
      .from(entities)
      .where(eq(entities.userId, userId))
      .orderBy(
        queryEmbedding
          ? sql`${entities.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'`)}::vector`
          : sql`RANDOM()`
      )
      .limit(5);

    const anchorIds = anchorCandidates.map((a) => a.id);
    const anchorNodes: GraphNode[] = anchorCandidates.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      metadata: a.metadata,
    }));

    // 2. Recursive Multi-Hop CTE Traversal (1-hop and 2-hop relations)
    let traversedEdges: GraphEdge[] = [];
    let connectedEntityIds = new Set<string>(anchorIds);

    if (anchorIds.length > 0) {
      try {
        const cteQuery = sql`
          WITH RECURSIVE graph_hops AS (
            SELECT 
              id, 
              from_entity_id, 
              to_entity_id, 
              relation_type, 
              weight, 
              1 as depth
            FROM entity_relations
            WHERE user_id = ${userId}
              AND (from_entity_id IN ${inArray(entityRelations.fromEntityId, anchorIds)} 
                   OR to_entity_id IN ${inArray(entityRelations.toEntityId, anchorIds)})
            UNION ALL
            SELECT 
              r.id, 
              r.from_entity_id, 
              r.to_entity_id, 
              r.relation_type, 
              r.weight, 
              h.depth + 1
            FROM entity_relations r
            INNER JOIN graph_hops h ON (r.from_entity_id = h.to_entity_id OR r.to_entity_id = h.from_entity_id)
            WHERE h.depth < 2
          )
          SELECT DISTINCT id, from_entity_id as "from", to_entity_id as "to", relation_type as "relationType", weight 
          FROM graph_hops 
          LIMIT 50;
        `;

        const cteResults: any = await db.execute(cteQuery);
        const rows = (cteResults.rows || cteResults) as Array<{
          id: string;
          from: string;
          to: string;
          relationType: string;
          weight: number;
        }>;

        traversedEdges = rows.map((r) => {
          connectedEntityIds.add(r.from);
          connectedEntityIds.add(r.to);
          return {
            id: r.id,
            from: r.from,
            to: r.to,
            relationType: r.relationType,
            weight: Number(r.weight || 1.0),
          };
        });
      } catch (rawCteErr: unknown) {
        const cteErr = toError(rawCteErr);
        logger.warn({ err: cteErr.message }, 'Recursive CTE failed, falling back to direct 1-hop query');
        const directEdges = await db
          .select({
            id: entityRelations.id,
            from: entityRelations.fromEntityId,
            to: entityRelations.toEntityId,
            relationType: entityRelations.relationType,
            weight: entityRelations.weight,
          })
          .from(entityRelations)
          .where(
            and(
              eq(entityRelations.userId, userId),
              inArray(entityRelations.fromEntityId, anchorIds)
            )
          )
          .limit(20);

        traversedEdges = directEdges;
        directEdges.forEach((e) => {
          connectedEntityIds.add(e.from);
          connectedEntityIds.add(e.to);
        });
      }
    }

    // 3. Fetch Connected Entities Details
    const allConnectedIds = Array.from(connectedEntityIds);
    let traversedNodes: GraphNode[] = [];
    if (allConnectedIds.length > 0) {
      const nodeRecords = await db
        .select({
          id: entities.id,
          name: entities.name,
          type: entities.type,
          metadata: entities.metadata,
        })
        .from(entities)
        .where(and(eq(entities.userId, userId), inArray(entities.id, allConnectedIds)));

      traversedNodes = nodeRecords.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        metadata: n.metadata,
      }));
    }

    // 4. Assemble Multi-Modal Candidates for Cross-Encoder Re-Ranking
    const nodeMap = new Map(traversedNodes.map((n) => [n.id, n.name]));
    const candidates: RerankCandidate[] = [];

    // Graph Edge Statements
    for (const edge of traversedEdges) {
      const fromName = nodeMap.get(edge.from) || 'Entity';
      const toName = nodeMap.get(edge.to) || 'Entity';
      candidates.push({
        id: `graph-edge-${edge.id}`,
        text: `[Graph Relation] ${fromName} ${edge.relationType.replace(/_/g, ' ')} ${toName}`,
        sourceType: 'graph_entity',
        originalScore: 0.85,
      });
    }

    // Hybrid Semantic Memory Search
    try {
      const memoryResults = await memoryService.searchMemory(userId, query, { topK: 10, mode: 'hybrid' });
      for (const mem of memoryResults) {
        candidates.push({
          id: `mem-${mem.id}`,
          text: `[Verified Memory: ${mem.type}] ${mem.content}`,
          sourceType: 'memory',
          originalScore: mem.score,
          timestamp: mem.createdAt,
        });
      }
    } catch (rawMemErr: unknown) {
      const memErr = toError(rawMemErr);
      logger.warn({ err: memErr.message }, 'Memory search failed in GraphRAG pass');
    }

    // 5. Cross-Encoder Re-Ranking Pass
    const rerankedContext = await rerankerService.rerank(query, candidates, 5);

    // 6. Format XML Prompt Block
    const formattedContextBlock = `
<graph_rag_context query="${query.replace(/"/g, '')}">
${rerankedContext.map((c, i) => `[Fact ${i + 1} | Confidence: ${c.confidencePct}% | Source: ${c.sourceType}]\n${c.text}`).join('\n\n')}
</graph_rag_context>
`.trim();

    const latencyMs = Date.now() - startTime;
    logger.info(
      { userId, anchorsFound: anchorNodes.length, edgesTraversed: traversedEdges.length, latencyMs },
      'GraphRAG execution completed successfully'
    );

    return {
      query,
      anchorEntities: anchorNodes,
      traversedNodes,
      traversedEdges,
      rerankedContext,
      formattedContextBlock,
      latencyMs,
    };
  }
}

export const graphRAGService = new GraphRAGService();
