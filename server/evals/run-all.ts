import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPriorityEval } from './priority.eval.js';
import { runToolSelectionEval } from './tool-selection.eval.js';
import { runRetrievalEvals } from './retrieval-precision.eval.js';
import { runInjectionResistanceEvals } from './injection-resistance.eval.js';
import { isLiveEvalMode, getLiveProviderName, isDatabaseReachable } from './eval-config.js';
import type { EvalReport } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NO_DB_SKIP_REASON =
  'No reachable database configured (DATABASE_URL unset, unreachable, or a dummy test value). This suite seeds/reads real rows via Drizzle and cannot run without one.';

function skippedReport(suite: string, reason: string): EvalReport {
  return {
    suite,
    runAt: new Date().toISOString(),
    total: 0,
    passed: 0,
    failed: 0,
    durationMs: 0,
    results: [],
    skipped: true,
    skipReason: reason,
  };
}

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

  const dbReachable = await isDatabaseReachable();
  if (!dbReachable) {
    console.log(
      '⚠️  No reachable database detected — suites 3 and 4 (retrieval precision, prompt-injection defense) ' +
        'need one to seed/read real rows and will be reported as SKIPPED. Suites 1 and 2 do not need a ' +
        'database and still run and gate the exit code.\n',
    );
  }

  const reports: EvalReport[] = [];

  // Suite 1: Deterministic Priority Engine Scenarios (Stage 1) — never touches the database.
  console.log('📦 [Suite 1: Deterministic Priority Engine]');
  const priorityReport = await runPriorityEval();
  reports.push(priorityReport);
  console.log(`  Passed: ${priorityReport.passed}/${priorityReport.total} scenarios\n`);

  // Suite 2: Agent Tool-Calling & Dual-Boundary Policy Engine (Stage 2) — touches the database
  // for memory search/circuit-breaker checks, but every call site treats a DB error as
  // non-fatal (graceful degradation), so this suite runs fine without one.
  console.log('📦 [Suite 2: Agent Tool-Calling & Policy Engine]');
  const toolReport = await runToolSelectionEval();
  reports.push(toolReport);
  console.log(`  Passed: ${toolReport.passed}/${toolReport.total} scenarios\n`);

  // Suite 3: Long-Term Memory & Hybrid RAG Retrieval (Stage 3) — requires a real database:
  // ensureEvalUser/reseedEvalMemories persist real rows with no fallback on connection failure.
  // In mock mode, embeddings also come from MockAiProvider's deterministic-but-semantically-empty
  // pseudo-embedding, so even with a DB, real hybrid retrieval quality can't be measured here — a
  // low mock pass rate is expected and does NOT indicate a code regression. It is excluded from
  // the CI pass/fail gate in mock mode; in live mode (with a real DB) it uses real embeddings and IS gated.
  console.log('📦 [Suite 3: Memory + Hybrid RAG Precision]');
  const retrievalReport = dbReachable ? await runRetrievalEvals() : skippedReport('Retrieval Precision', NO_DB_SKIP_REASON);
  reports.push(retrievalReport);
  if (retrievalReport.skipped) {
    console.log(`  SKIPPED: ${retrievalReport.skipReason}\n`);
  } else {
    console.log(
      `  Passed: ${retrievalReport.passed}/${retrievalReport.total} scenarios${live ? '' : '  (informational only in mock mode — see note above)'}\n`,
    );
  }

  // Suite 4: Prompt-Injection Defense & Policy Boundary Integrity (Stage 4) — also requires a
  // real database: it seeds its own eval user/session/messages via Drizzle with no fallback.
  console.log('📦 [Suite 4: Prompt-Injection Defense & Policy Boundary]');
  const injectionReport = dbReachable
    ? await runInjectionResistanceEvals()
    : skippedReport('Prompt-Injection Defense', NO_DB_SKIP_REASON);
  reports.push(injectionReport);
  if (injectionReport.skipped) {
    console.log(`  SKIPPED: ${injectionReport.skipReason}\n`);
  } else {
    console.log(`  Passed: ${injectionReport.passed}/${injectionReport.total} scenarios\n`);
  }

  // Overall summary/gate. Skipped suites never count (nothing ran to pass or fail). Retrieval
  // precision is additionally excluded from the gate in mock mode only, even when it did run
  // (see note above) — it is still fully counted in the saved report.
  const gatingReports = reports.filter((r) => !r.skipped && (live || r.suite !== retrievalReport.suite));
  const totalScenarios = gatingReports.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = gatingReports.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = gatingReports.reduce((sum, r) => sum + r.failed, 0);
  const passRate = totalScenarios > 0 ? (totalPassed / totalScenarios) * 100 : 0;

  console.log('-------------------------------------------');
  console.log(
    `🎯 Overall Eval Results: ${totalPassed}/${totalScenarios} Passed (${totalFailed} Failed) - ${passRate.toFixed(1)}%`,
  );
  console.log('-------------------------------------------');

  const skippedSuites = reports.filter((r) => r.skipped).map((r) => r.suite);
  const retrievalExcludedForMockMode = !live && !retrievalReport.skipped;

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
      skippedSuites: skippedSuites.length > 0 ? skippedSuites : undefined,
      note: retrievalExcludedForMockMode
        ? `Metrics exclude "${retrievalReport.suite}" (${retrievalReport.passed}/${retrievalReport.total}): mock-mode embeddings are not semantically meaningful, so its pass rate is not a real quality signal. Its true numbers are still listed under "suites" below and are gated in live mode.`
        : undefined,
    },
    suites: reports.map((r) => ({
      suite: r.suite,
      total: r.total,
      passed: r.passed,
      failed: r.failed,
      durationMs: r.durationMs,
      skipped: r.skipped || undefined,
      skipReason: r.skipReason,
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
