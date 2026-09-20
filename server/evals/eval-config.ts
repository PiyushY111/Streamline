/**
 * Shared live/mock mode switch for the eval harness.
 *
 * Mock mode (default): deterministic, zero-cost, safe for CI. Suites that exercise
 * an AI provider use MockAiProvider.
 *
 * Live mode (`--live` or `EVAL_LIVE=1`): suites that call an AI provider swap in the
 * real configured provider (AI_PROVIDER, default "gemini") and make real API calls.
 *
 * Not every suite is affected: `priority.eval.ts` (deterministic scoring engine) and
 * `tool-selection.eval.ts` (policy engine given a pre-specified tool call) never invoke
 * an AI provider at all, so live mode is a no-op for them. See evals/README.md.
 */
export function isLiveEvalMode(): boolean {
  return process.env.EVAL_LIVE === '1' || process.argv.includes('--live');
}

export function getLiveProviderName(): string {
  return process.env.AI_PROVIDER || 'gemini';
}
