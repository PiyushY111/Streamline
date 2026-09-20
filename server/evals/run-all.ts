import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPriorityEval } from './priority.eval.js';
import { runToolSelectionEval } from './tool-selection.eval.js';
import { runRetrievalEvals } from './retrieval-precision.eval.js';
import { runInjectionResistanceEvals } from './injection-resistance.eval.js';
import { isLiveEvalMode, getLiveProviderName } from './eval-config.js';
import type { EvalReport } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const live = isLiveEvalMode();

  if (live) {
    console.log('🧪 Running Streamline AI Evaluation Harness — LIVE MODE');
    console.log(`   Provider: ${getLiveProviderName()} (real API calls, real cost, non-deterministic)`);
    console.log(
      '   Note: priority.eval.ts and tool-selection.eval.ts never call an AI provider — this flag has no effect on those two suites.\n',
    );
  } else {
    console.log('🧪 Running Streamline AI Evaluation Harness — mock mode (fast, deterministic, CI default)\n');
  }

  const reports: EvalReport[] = [];

  // Suite 1: Deterministic Priority Engine Scenarios (Stage 1)
  console.log('📦 [Suite 1: Deterministic Priority Engine]');
  const priorityReport = await runPriorityEval();
  reports.push(priorityReport);
  console.log(`  Passed: ${priorityReport.passed}/${priorityReport.total} scenarios\n`);

  // Suite 2: Agent Tool-Calling & Dual-Boundary Policy Engine (Stage 2)
  console.log('📦 [Suite 2: Agent Tool-Calling & Policy Engine]');
  const toolReport = await runToolSelectionEval();
  reports.push(toolReport);
  console.log(`  Passed: ${toolReport.passed}/${toolReport.total} scenarios\n`);

  // Suite 3: Long-Term Memory & Hybrid RAG Retrieval (Stage 3)
  // In mock mode, embeddings come from MockAiProvider's deterministic-but-semantically-empty
  // pseudo-embedding, so real hybrid retrieval quality genuinely cannot be measured here — a
  // low mock pass rate is expected and does NOT indicate a code regression. It is reported for
  // visibility (and to smoke-test that the real code path runs without error) but is excluded
  // from the CI pass/fail gate in mock mode. In live mode it uses real embeddings and IS gated.
  console.log('📦 [Suite 3: Memory + Hybrid RAG Precision]');
  const retrievalReport = await runRetrievalEvals();
  reports.push(retrievalReport);
  console.log(
    `  Passed: ${retrievalReport.passed}/${retrievalReport.total} scenarios${live ? '' : '  (informational only in mock mode — see note above)'}\n`,
  );

  // Suite 4: Prompt-Injection Defense & Policy Boundary Integrity (Stage 4)
  console.log('📦 [Suite 4: Prompt-Injection Defense & Policy Boundary]');
  const injectionReport = await runInjectionResistanceEvals();
  reports.push(injectionReport);
  console.log(`  Passed: ${injectionReport.passed}/${injectionReport.total} scenarios\n`);

  // Overall summary. Retrieval precision is excluded from the hard CI gate in mock mode only
  // (see note above) — it is still fully counted in the saved report and in live mode.
  const gatingReports = live ? reports : reports.filter((r) => r.suite !== retrievalReport.suite);
  const totalScenarios = gatingReports.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = gatingReports.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = gatingReports.reduce((sum, r) => sum + r.failed, 0);
  const passRate = totalScenarios > 0 ? (totalPassed / totalScenarios) * 100 : 0;

  console.log('-------------------------------------------');
  console.log(
    `🎯 Overall Eval Results: ${totalPassed}/${totalScenarios} Passed (${totalFailed} Failed) - ${passRate.toFixed(1)}%`,
  );
  console.log('-------------------------------------------');

  // Save tracked benchmark summary JSON
  const benchmarkSummary = {
    version: '1.0.0',
    mode: live ? 'live' : 'mock',
    provider: live ? getLiveProviderName() : 'mock',
    timestamp: new Date().toISOString(),
    metrics: {
      totalScenarios,
      passedScenarios: totalPassed,
      failedScenarios: totalFailed,
      passRate: `${passRate.toFixed(1)}%`,
      status: totalFailed === 0 ? 'PASSED' : 'FAILED',
      note: live
        ? undefined
        : `Metrics exclude "${retrievalReport.suite}" (${retrievalReport.passed}/${retrievalReport.total}): mock-mode embeddings are not semantically meaningful, so its pass rate is not a real quality signal. Its true numbers are still listed under "suites" below and are gated in live mode.`,
    },
    suites: reports.map((r) => ({
      suite: r.suite,
      total: r.total,
      passed: r.passed,
      failed: r.failed,
      durationMs: r.durationMs,
    })),
  };

  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Mock runs overwrite the tracked benchmark-summary.json (fast CI default, single source of truth).
  // Live runs never overwrite history: each run gets its own timestamped file under results/live/.
  let summaryPath: string;
  if (live) {
    const liveDir = path.join(resultsDir, 'live');
    if (!fs.existsSync(liveDir)) {
      fs.mkdirSync(liveDir, { recursive: true });
    }
    summaryPath = path.join(liveDir, `benchmark-summary-live-${Date.now()}.json`);
  } else {
    summaryPath = path.join(resultsDir, 'benchmark-summary.json');
  }
  fs.writeFileSync(summaryPath, JSON.stringify(benchmarkSummary, null, 2), 'utf-8');
  console.log(`📄 Saved benchmark summary artifact to ${summaryPath}\n`);

  if (totalFailed > 0) {
    console.error('❌ Eval suite finished with failures.');
    process.exit(1);
  } else {
    console.log('✅ All eval scenarios passed successfully!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error running eval suite:', err);
  process.exit(1);
});
