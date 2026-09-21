export interface EvalScenario<TInput = unknown, TExpected = unknown> {
  id: string;
  description: string;
  input: TInput;
  expected: TExpected;
  tags?: string[];
}

export interface EvalResult {
  scenarioId: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  notes?: string;
}

export interface EvalReport {
  suite: string;
  runAt: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: EvalResult[];
  /** True when the suite was not run at all (e.g. no reachable database) rather than run-and-failed. */
  skipped?: boolean;
  skipReason?: string;
}
