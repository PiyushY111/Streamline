import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchMemory, MemoryType } from '../src/services/ai/memory/memory.service.js';
import { setAiProvider, getAiProvider } from '../src/services/ai/core/factory.js';
import { MockAiProvider } from '../src/services/ai/core/providers/mock.provider.js';
import { isLiveEvalMode, getLiveProviderName } from './eval-config.js';
import { ensureEvalUser, reseedEvalMemories, clearEvalMemories } from './retrieval-eval-helpers.js';
import type { EvalScenario } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RetrievalScenarioInput {
  query: string;
  type?: MemoryType;
  topK?: number;
}

interface RetrievalScenarioExpected {
  expectedSubstring: string;
  maxRank: number;
}

type RetrievalMode = 'vector' | 'keyword' | 'hybrid';

interface ModeResult {
  mode: RetrievalMode;
  total: number;
  passed: number;
  precisionAtK: number;
  mrr: number;
  failedScenarioIds: string[];
}

const EVAL_USER_EMAIL = 'eval-retrieval-ablation@streamline.internal';
const MODES: RetrievalMode[] = ['vector', 'keyword', 'hybrid'];

/**
 * RAG ablation: runs the SAME 25-query set from retrieval-precision.json through three real
 * retrieval configurations — vector-only (pgvector HNSW cosine), keyword-only (Postgres
 * tsvector), and the production default (hybrid RRF fusion, k=60) — and reports precision@k
 * and MRR for each side by side. This is a comparison report, not a pass/fail gate: it is
 * intentionally NOT wired into run-all.ts's CI exit code.
 *
 * Only meaningful in LIVE mode. In mock mode, MockAiProvider's pseudo-embedding is not
 * semantically meaningful, so the "vector" and "hybrid" columns would just reflect that
 * artifact, not real retrieval quality — this script warns loudly and still runs (so the
 * pipeline itself is smoke-tested end to end) but the printed comparison is not meant to be
 * read as ground truth outside live mode.
 *
 * See docs/adr/0006-pgvector-over-dedicated-vector-db.md for the honest conclusion this data
 * supports (or doesn't).
 */
async function runAblationForMode(userId: string, mode: RetrievalMode, scenarios: EvalScenario<RetrievalScenarioInput, RetrievalScenarioExpected>[]): Promise<ModeResult> {
  let passed = 0;
  let totalRankScore = 0;
  const failedScenarioIds: string[] = [];

  for (const scenario of scenarios) {
    const results = await searchMemory(userId, scenario.input.query, {
      type: scenario.input.type,
      topK: scenario.input.topK || 5,
      mode,
    });

    const contents = results.map((r) => r.content);
    const rankIndex = contents.findIndex((content) =>
      content.toLowerCase().includes(scenario.expected.expectedSubstring.toLowerCase()),
    );

    if (rankIndex !== -1 && rankIndex < scenario.expected.maxRank) {
      passed++;
      totalRankScore += 1 / (rankIndex + 1);
    } else {
      failedScenarioIds.push(scenario.id);
    }
  }

  return {
    mode,
    total: scenarios.length,
    passed,
    precisionAtK: scenarios.length > 0 ? (passed / scenarios.length) * 100 : 0,
    mrr: scenarios.length > 0 ? totalRankScore / scenarios.length : 0,
    failedScenarioIds,
  };
}

export async function runRetrievalAblation(): Promise<ModeResult[]> {
  const live = isLiveEvalMode();

  console.log(`\n🔬 RAG Ablation: vector-only vs. keyword-only vs. hybrid RRF [${live ? 'LIVE' : 'MOCK — see caveat below'}]`);
  if (!live) {
    console.log(
      '   ⚠️  Mock-mode embeddings are not semantically meaningful. This run smoke-tests the pipeline only — re-run with EVAL_LIVE=1 for a real comparison.',
    );
  }

  if (live) {
    setAiProvider(getAiProvider(getLiveProviderName()));
  } else {
    setAiProvider(new MockAiProvider());
  }
  const provider = getAiProvider();

  const userId = await ensureEvalUser(EVAL_USER_EMAIL);
  await reseedEvalMemories(userId, provider);

  const scenarioPath = path.join(__dirname, 'scenarios', 'retrieval-precision.json');
  const scenarios: EvalScenario<RetrievalScenarioInput, RetrievalScenarioExpected>[] = JSON.parse(
    fs.readFileSync(scenarioPath, 'utf-8'),
  );

  try {
    const results: ModeResult[] = [];
    for (const mode of MODES) {
      results.push(await runAblationForMode(userId, mode, scenarios));
    }

    console.log('\n   Mode      | Precision@k | MRR   | Passed');
    console.log('   ----------|-------------|-------|-------');
    for (const r of results) {
      console.log(
        `   ${r.mode.padEnd(9)} | ${r.precisionAtK.toFixed(1).padStart(9)}% | ${r.mrr.toFixed(3)} | ${r.passed}/${r.total}`,
      );
    }

    const hybrid = results.find((r) => r.mode === 'hybrid')!;
    const vectorOnly = results.find((r) => r.mode === 'vector')!;
    const keywordOnly = results.find((r) => r.mode === 'keyword')!;
    const hybridBeatsBoth = hybrid.precisionAtK > vectorOnly.precisionAtK && hybrid.precisionAtK > keywordOnly.precisionAtK;
    console.log(
      `\n   Hybrid strictly beats both alternatives on this query set: ${hybridBeatsBoth ? 'YES' : 'NO — see honest note needed in ADR-0006'}\n`,
    );

    const resultsDir = path.join(__dirname, 'results', live ? 'live' : 'mock-smoke');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const outPath = path.join(resultsDir, `retrieval-ablation-${live ? 'live' : 'mock'}-${Date.now()}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ mode: live ? 'live' : 'mock', timestamp: new Date().toISOString(), results, hybridBeatsBoth }, null, 2),
    );
    console.log(`   📄 Saved ablation report to ${outPath}`);

    return results;
  } finally {
    await clearEvalMemories(userId);
    setAiProvider(null);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRetrievalAblation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Ablation eval failed:', err);
      process.exit(1);
    });
}
