import { runSuite } from './runner.js';
import { searchMemory, MemoryType } from '../src/services/ai/memory/memory.service.js';
import { setAiProvider, getAiProvider } from '../src/services/ai/core/factory.js';
import { MockAiProvider } from '../src/services/ai/core/providers/mock.provider.js';
import { isLiveEvalMode, getLiveProviderName } from './eval-config.js';
import { ensureEvalUser, reseedEvalMemories, clearEvalMemories } from './retrieval-eval-helpers.js';

interface RetrievalScenarioInput {
  query: string;
  type?: MemoryType;
  topK?: number;
}

interface RetrievalScenarioExpected {
  expectedSubstring: string;
  maxRank: number;
}

const EVAL_USER_EMAIL = 'eval-retrieval-precision@streamline.internal';

/**
 * Exercises the REAL hybrid RRF retrieval path (memory.service.ts:searchMemory) against
 * seeded rows in Postgres/pgvector — not a reimplemented scorer. In mock mode, embeddings
 * come from MockAiProvider's deterministic pseudo-embedding (character-code based), which
 * is NOT semantically meaningful, so only the sparse/tsvector half of the RRF fusion is a
 * reliable signal; dense-only queries with no keyword overlap may fail in mock mode even
 * though the code path is real. Live mode uses real embeddings and is the only mode that
 * measures actual semantic retrieval quality. See evals/README.md.
 */
export async function runRetrievalEvals() {
  const live = isLiveEvalMode();
  if (live) {
    setAiProvider(getAiProvider(getLiveProviderName()));
  } else {
    setAiProvider(new MockAiProvider());
  }
  const provider = getAiProvider();

  const userId = await ensureEvalUser(EVAL_USER_EMAIL);
  await reseedEvalMemories(userId, provider);

  try {
    let totalRankScore = 0;
    let totalQueries = 0;

    const report = await runSuite<RetrievalScenarioInput, RetrievalScenarioExpected>(
      live ? 'retrieval-precision-and-mrr-live' : 'retrieval-precision-and-mrr',
      'retrieval-precision.json',
      async (input) => {
        const results = await searchMemory(userId, input.query, {
          type: input.type,
          topK: input.topK || 5,
          mode: 'hybrid',
        });
        return results.map((r) => r.content);
      },
      (actual: any, expected) => {
        totalQueries++;
        const rankIndex = (actual as string[]).findIndex((content) =>
          content.toLowerCase().includes(expected.expectedSubstring.toLowerCase()),
        );

        if (rankIndex !== -1 && rankIndex < expected.maxRank) {
          totalRankScore += 1 / (rankIndex + 1);
          return true;
        }

        return false;
      },
    );

    const mrr = totalQueries > 0 ? (totalRankScore / totalQueries).toFixed(3) : '0.000';
    console.log(
      `  📊 Retrieval Evaluation Metrics [${live ? 'LIVE:' + provider.name : 'MOCK'}]: Precision@k = ${((report.passed / report.total) * 100).toFixed(1)}%, MRR = ${mrr}`,
    );

    return report;
  } finally {
    await clearEvalMemories(userId);
    setAiProvider(null);
  }
}
