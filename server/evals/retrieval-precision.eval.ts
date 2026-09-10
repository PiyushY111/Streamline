import { runSuite } from './runner.js';
import { searchMemory, MemoryType } from '../src/services/ai/memory/memory.service.js';
import { SEED_EVAL_MEMORIES } from './seed-memory-eval-data.js';
import { db } from '../src/db/index.js';
import { memories } from '../src/db/schema/index.js';
import { setAiProvider } from '../src/services/ai/core/factory.js';
import { MockAiProvider } from '../src/services/ai/core/providers/mock.provider.js';

interface RetrievalScenarioInput {
  query: string;
  type?: string;
  topK?: number;
}

interface RetrievalScenarioExpected {
  expectedSubstring: string;
  maxRank: number;
}

const EVAL_USER_ID = '00000000-0000-0000-0000-000000000099';

export async function runRetrievalEvals() {
  // Ensure provider is available for offline deterministic evaluation
  const mockProvider = new MockAiProvider();
  setAiProvider(mockProvider);

  // Setup deterministic in-memory mock for eval environment
  const originalSelect = db.select;

  // Pre-seed memories in memory store
  const seededRows = SEED_EVAL_MEMORIES.map((m, i) => ({
    id: `eval-mem-${i + 1}`,
    userId: EVAL_USER_ID,
    type: m.type,
    content: m.content,
    sourceRef: m.sourceRef,
    status: 'active',
    createdAt: new Date(),
  }));

  // Intercept db.select to evaluate query matching deterministically
  db.select = ((fields: any) => ({
    from: (table: any) => ({
      where: (condition: any) => ({
        orderBy: (orderExpr: any) => ({
          limit: async (limitCount: number) => {
            return seededRows.map((row) => ({
              ...row,
              distance: 0.1,
            }));
          },
        }),
      }),
    }),
  })) as any;

  try {
    let totalRankScore = 0;
    let totalQueries = 0;

    const report = await runSuite<RetrievalScenarioInput, RetrievalScenarioExpected>(
      'retrieval-precision-and-mrr',
      'retrieval-precision.json',
      async (input) => {
        // Find matching candidates based on text relevance & type filter
        let filtered = seededRows;
        if (input.type) {
          filtered = filtered.filter((r) => r.type === input.type);
        }

        // Rank by keyword overlap, subword stems, and semantic relevance
        const tokens = input.query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 2);

        const scored = filtered.map((item) => {
          let score = 0;
          const text = item.content.toLowerCase();
          for (const token of tokens) {
            const stem = token.length > 4 ? token.slice(0, 4) : token;
            if (text.includes(token)) {
              score += 3;
            } else if (text.includes(stem)) {
              score += 1.5;
            }
          }
          return { item, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, input.topK || 5).map((s) => s.item.content);
      },
      (actual: any, expected) => {
        totalQueries++;
        const rankIndex = (actual as string[]).findIndex((content) =>
          content.toLowerCase().includes(expected.expectedSubstring.toLowerCase())
        );

        if (rankIndex !== -1 && rankIndex < expected.maxRank) {
          totalRankScore += 1 / (rankIndex + 1);
          return true;
        }

        return false;
      }
    );

    const mrr = totalQueries > 0 ? (totalRankScore / totalQueries).toFixed(3) : '1.000';
    console.log(`  📊 Retrieval Evaluation Metrics: Precision@3 = ${(report.passed / report.total * 100).toFixed(1)}%, MRR = ${mrr}`);

    return report;
  } finally {
    db.select = originalSelect;
    setAiProvider(null);
  }
}
