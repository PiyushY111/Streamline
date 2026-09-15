import { logger } from '../../../utils/logger.js';

export interface RerankCandidate {
  id: string;
  text: string;
  sourceType: 'memory' | 'email' | 'graph_entity' | 'task';
  originalScore?: number;
  timestamp?: Date | string;
  metadata?: Record<string, unknown>;
}

export interface RerankedResult extends RerankCandidate {
  relevanceScore: number; // 0.0 to 1.0
  confidencePct: number;  // 0 to 100%
}

export class RerankerService {
  /**
   * Re-rank a candidate list against a query using Cohere Rerank API or intelligent local fallback
   */
  public async rerank(
    query: string,
    candidates: RerankCandidate[],
    topN: number = 5
  ): Promise<RerankedResult[]> {
    if (!candidates || candidates.length === 0) return [];
    if (candidates.length <= topN && !process.env.COHERE_API_KEY) {
      return this.applyLocalScoring(query, candidates, topN);
    }

    const cohereApiKey = process.env.COHERE_API_KEY;

    if (cohereApiKey) {
      try {
        const response = await fetch('https://api.cohere.com/v2/rerank', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cohereApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'rerank-v3.5',
            query,
            documents: candidates.map((c) => c.text.slice(0, 1000)),
            top_n: topN,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.results && Array.isArray(data.results)) {
            return data.results.map((res: any) => {
              const candidate = candidates[res.index];
              const relevanceScore = Math.min(1.0, Math.max(0.0, res.relevance_score));
              return {
                ...candidate,
                relevanceScore,
                confidencePct: Math.round(relevanceScore * 100),
              };
            });
          }
        } else {
          logger.warn({ status: response.status }, 'Cohere Rerank API returned non-200, falling back to local scoring');
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Failed to call Cohere Rerank API, using local scoring fallback');
      }
    }

    // High-performance Local Heuristic Scoring Fallback
    return this.applyLocalScoring(query, candidates, topN);
  }

  /**
   * Local normalized scoring with keyword affinity, base RRF, and exponential temporal decay
   */
  private applyLocalScoring(
    query: string,
    candidates: RerankCandidate[],
    topN: number
  ): RerankedResult[] {
    const queryTokens = new Set(
      query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((t) => t.length > 2)
    );

    const now = Date.now();
    const halfLifeHours = 720; // 30-day temporal half-life

    const scored = candidates.map((cand) => {
      const textLower = cand.text.toLowerCase();
      let matchCount = 0;

      for (const token of queryTokens) {
        if (textLower.includes(token)) {
          matchCount++;
        }
      }

      const tokenScore = queryTokens.size > 0 ? matchCount / queryTokens.size : 0.5;
      const baseScore = cand.originalScore !== undefined ? cand.originalScore : 0.5;

      // Temporal Decay calculation
      let timeDecay = 1.0;
      if (cand.timestamp) {
        const timeMs = new Date(cand.timestamp).getTime();
        if (!isNaN(timeMs)) {
          const ageHours = Math.max(0, (now - timeMs) / (1000 * 60 * 60));
          timeDecay = Math.exp(-ageHours / halfLifeHours);
        }
      }

      // Hybrid blended relevance score
      const finalScore = Math.min(
        0.99,
        Math.max(0.01, (baseScore * 0.4 + tokenScore * 0.4) * (0.8 + 0.2 * timeDecay))
      );

      return {
        ...cand,
        relevanceScore: Number(finalScore.toFixed(4)),
        confidencePct: Math.round(finalScore * 100),
      };
    });

    return scored
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topN);
  }
}

export const rerankerService = new RerankerService();
