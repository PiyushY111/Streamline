import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvalScenario, EvalReport, EvalResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSuite<TInput, TExpected>(
  suiteName: string,
  scenarioFile: string,
  execute: (input: TInput) => Promise<unknown>,
  compare: (actual: unknown, expected: TExpected) => boolean,
): Promise<EvalReport> {
  const scenarioPath = path.join(__dirname, 'scenarios', scenarioFile);
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(`Scenario file not found: ${scenarioPath}`);
  }

  const scenarios: EvalScenario<TInput, TExpected>[] = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));

  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    let actual: unknown;
    let passed = false;
    try {
      actual = await execute(scenario.input);
      passed = compare(actual, scenario.expected);
    } catch (err: any) {
      actual = { error: err.message };
      passed = false;
    }
    results.push({
      scenarioId: scenario.id,
      passed,
      actual,
      expected: scenario.expected,
    });
  }

  const report: EvalReport = {
    suite: suiteName,
    runAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };

  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const outPath = path.join(resultsDir, `${suiteName}-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  return report;
}
