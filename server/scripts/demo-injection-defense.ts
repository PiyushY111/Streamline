import 'dotenv/config';
import { runInjectionResistanceEvals } from '../evals/injection-resistance.eval.js';
import { isLiveEvalMode } from '../evals/eval-config.js';

/**
 * This used to be a standalone scripted demo (single hardcoded attack, mocked model
 * responses, console-log theater) whose imports had also gone stale after the AI service
 * directory was reorganized (`ai/agent-orchestrator.service.js`, `ai/ai.factory.js`, etc. no
 * longer exist) — it would have crashed if anyone actually ran it.
 *
 * It has been replaced with a thin CLI wrapper around the real adversarial suite in
 * evals/injection-resistance.eval.ts (21 attack/control scenarios across multiple injection
 * techniques). Run `tsx scripts/demo-injection-defense.ts` for a mock-scripted policy-boundary
 * check, or `EVAL_LIVE=1 tsx scripts/demo-injection-defense.ts` (equivalently
 * `npm run eval:live`, which also runs the other suites) to see the real configured model
 * decide for itself against the same attack corpus.
 */
async function main() {
  const live = isLiveEvalMode();
  console.log('===============================================================');
  console.log('🛡️  STREAMLINE AGENTIC SECURITY: PROMPT-INJECTION DEFENSE SUITE');
  console.log(`   Mode: ${live ? 'LIVE (real model)' : 'MOCK-SCRIPTED (policy boundary only, no model judgment)'}`);
  console.log('===============================================================\n');

  const report = await runInjectionResistanceEvals();

  console.log(`\n${report.suite}: ${report.passed}/${report.total} scenarios held the safety invariant.`);
  if (report.failed > 0) {
    console.log('❌ Failing scenarios:');
    for (const r of report.results) {
      if (!r.passed) {
        console.log(`   - ${r.scenarioId}`);
      }
    }
    process.exit(1);
  }

  console.log('✅ Zero unapproved executions across all scenarios.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Injection defense suite error:', err);
  process.exit(1);
});
