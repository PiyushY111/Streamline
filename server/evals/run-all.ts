import { runPriorityEval } from './priority.eval.js';
import { runToolSelectionEval } from './tool-selection.eval.js';
import { runRetrievalEvals } from './retrieval-precision.eval.js';
import type { EvalReport } from './types.js';

async function main() {
  console.log('🧪 Running Streamline AI Evaluation Harness...\n');
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
  console.log('📦 [Suite 3: Memory + Hybrid RAG Precision]');
  const retrievalReport = await runRetrievalEvals();
  reports.push(retrievalReport);
  console.log(`  Passed: ${retrievalReport.passed}/${retrievalReport.total} scenarios\n`);


  // Overall summary
  const totalScenarios = reports.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = reports.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = reports.reduce((sum, r) => sum + r.failed, 0);

  console.log('-------------------------------------------');
  console.log(`🎯 Overall Eval Results: ${totalPassed}/${totalScenarios} Passed (${totalFailed} Failed)`);
  console.log('-------------------------------------------');

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
