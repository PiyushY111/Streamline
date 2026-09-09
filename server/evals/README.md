# AI Eval Harness (`server/evals`)

This directory contains the automated scenario-based evaluation harness for Streamline's AI features, independent of standard unit tests (see [ADR-0007](../../docs/adr/0007-scenario-based-eval-harness.md)).

## Structure

```
evals/
  README.md
  runner.ts                    # Generic asynchronous scenario evaluation runner
  types.ts                     # Shared TypeScript interfaces (EvalScenario, EvalReport, EvalResult)
  run-all.ts                   # Master entrypoint running all test suites
  scenarios/
    priority-scenarios.json    # Stage 1 — Deterministic priority engine test cases
    tool-selection.json        # Stage 2 — Agent tool selection & parameter accuracy
    retrieval-precision.json   # Stage 3 — Semantic vector memory retrieval precision
    injection-resistance.json  # Stage 4 — Prompt injection resistance & security defense
  results/
    .gitkeep                   # Timestamped JSON reports generated per run (gitignored)
```

## Running Evaluations

To run all evaluation suites:

```bash
# From workspace root:
npm run eval

# Or from server/:
npm run eval
```

## Adding New Scenarios

1. Add your scenario objects into the corresponding JSON file under `evals/scenarios/`.
2. Each scenario must satisfy `EvalScenario`:
   - `id`: unique scenario identifier
   - `description`: readable explanation of the test condition
   - `input`: input payload fed into the evaluated function
   - `expected`: expected ground-truth structure or assertion criteria
   - `tags`: classification tags (e.g. `["p1", "vip", "regression"]`)
