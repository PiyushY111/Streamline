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

const DB_PROBE_TIMEOUT_MS = 5000;

/**
 * Probes whether DATABASE_URL points at a real, reachable database.
 *
 * Two eval suites (retrieval-precision.eval.ts, injection-resistance.eval.ts) persist
 * seeded users/memories/sessions via Drizzle and hard-fail (not gracefully degrade) if
 * the database is unreachable -- unlike tool-selection.eval.ts, which happens to touch
 * the same `db` client but treats every query failure as non-fatal. A dummy
 * DATABASE_URL (e.g. the vitest test-env default) has no listener at all, so a real
 * connection attempt fails fast; this lets run-all.ts skip those two suites cleanly
 * instead of crashing the whole harness.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    const { db } = await import('../src/db/client.js');
    const { sql } = await import('drizzle-orm');
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Database reachability probe timed out')), DB_PROBE_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}
