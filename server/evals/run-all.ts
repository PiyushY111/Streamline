import { runPriorityEval } from './priority.eval.js';

async function main() {
  console.log('🧪 Running Streamline AI Evaluation Harness...\n');
  const reports: EvalReport[] = [];

  // Suite 1: Deterministic Priority Engine Scenarios (Stage 1)
  console.log('📦 [Suite: Deterministic Priority Engine]');
  const priorityReport = await runPriorityEval();
  reports.push(priorityReport);
  console.log(`  Passed: ${priorityReport.passed}/${priorityReport.total} scenarios\n`);


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
