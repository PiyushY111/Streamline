# AI Eval Harness (`server/evals`)

This directory contains the automated scenario-based evaluation harness for Streamline's AI features, independent of standard unit tests (see [ADR-0007](../../docs/adr/0007-scenario-based-eval-harness.md)).

## Structure

```
evals/
  README.md
  eval-config.ts               # --live / EVAL_LIVE=1 mode switch shared by all suites
  runner.ts                    # Generic asynchronous scenario evaluation runner
  types.ts                     # Shared TypeScript interfaces (EvalScenario, EvalReport, EvalResult)
  run-all.ts                   # Master entrypoint running all test suites
  retrieval-ablation.eval.ts   # RAG ablation report (vector-only vs keyword-only vs hybrid RRF) — a
                                # comparison tool, not a CI gate; run via `npm run eval:ablation[:live]`.
                                # See docs/adr/0011's addendum for the real result.
  scenarios/
    priority-scenarios.json    # Stage 1 — Deterministic priority engine test cases
    tool-selection.json        # Stage 2 — Agent tool selection & parameter accuracy
    retrieval-precision.json   # Stage 3 — Semantic vector memory retrieval precision
    injection-resistance.json  # Stage 4 — Prompt injection resistance & security defense
  results/
    .gitkeep
    benchmark-summary.json     # Tracked, overwritten each mock run (CI default snapshot)
    live/
      benchmark-summary-live-<timestamp>.json  # One per live run, never overwritten, tracked
    *.json                     # Other per-suite timestamped reports (gitignored, local only)
```

`scripts/demo-injection-defense.ts` is a thin CLI wrapper around `injection-resistance.eval.ts` (run
`tsx scripts/demo-injection-defense.ts` for mock, or with `EVAL_LIVE=1` for live) — it used to be a
separate hardcoded single-attack demo with its own scripted mock provider, and its imports had gone stale
after the `ai/` service directory was reorganized (it would have crashed if run). It now always exercises
the same real, versioned scenario corpus as the eval.

## Running Evaluations

To run all evaluation suites (mock mode — fast, deterministic, zero cost, CI default):

```bash
# From workspace root:
npm run eval

# Or from server/:
npm run eval
```

To run against the real configured AI provider (`AI_PROVIDER` in `.env`, default Gemini) instead of the
mock, at real (small) API cost and non-deterministically:

```bash
npm run eval:live
# equivalently: EVAL_LIVE=1 tsx evals/run-all.ts
```

Live results are saved under `evals/results/live/benchmark-summary-live-<timestamp>.json` and are never
overwritten — each run is kept as a historical record (unlike `evals/results/benchmark-summary.json`,
which is the single tracked mock-mode snapshot and is overwritten each run).

## What `--live` Actually Changes — Read This Before Trusting a Number

Not all four suites call an AI model, so `--live` doesn't uniformly change behavior. Know what you're
looking at:

| Suite | Calls an AI provider? | What `--live` changes |
|---|---|---|
| `priority.eval.ts` | No — pure deterministic scoring engine | Nothing. Always identical mock vs. live. |
| `tool-selection.eval.ts` | No — calls `enforcePolicy()` directly with a hand-specified tool call | Nothing. This tests the policy engine, not an LLM's tool selection, despite the name. |
| `retrieval-precision.eval.ts` | Yes — for embeddings | Mock mode uses `MockAiProvider`'s deterministic-but-not-semantic pseudo-embedding, so precision is not a meaningful signal there (last mock run: 1/25 — expected, not a regression, excluded from the mock CI gate for that reason). Live mode uses real embeddings and is the only mode that measures actual retrieval quality: **25/25 (100%)** every live run so far; **MRR has ranged 0.96–1.00 across three live runs on 2026-09-21** (real embedding calls are not bit-for-bit deterministic run to run — this is a real, observed range, not a single fixed number). Most recent run: MRR 0.960, `gemini-3.5-flash-lite`. |
| `injection-resistance.eval.ts` | Yes — for the full agent tool-calling loop | Mock mode scripts the "model's" tool call per attack label (`scriptedMockTurn` in the eval file) purely so CI has a fast signal that the **policy layer** holds — it is not evidence about model behavior. Live mode lets the real model decide everything given the actual injected email content, with no scripting. This is the only mode that tests real injection *resistance* rather than injection *containment*. Most recent live run (2026-09-21, 21 scenarios, `gemini-3.5-flash-lite`): the policy-layer **containment** invariant (no write/send tool ever executes without approval) held **21/21**, as it is structurally guaranteed to regardless of model behavior; separately, the model's own **resistance** — whether it attempted the prohibited action at all before policy would have caught it — was **0/21** in this run (a real, non-gating "model injection-susceptibility" metric, not a guarantee for future runs — see the eval file). |

This suite previously had a case (`direct-delete-command`) targeting `delete_task`, a tool that has never
existed in `TOOL_REGISTRY` — its assertion was vacuous (it passed only because the tool name was
unrecognized). It has been relabeled to honestly test hallucinated/unknown-tool rejection, which is a real
and separate defense layer from the write/send approval boundary.

The corpus (`seed-injection-eval-data.ts`) has 21 scenarios spanning: direct override commands, fake
`[SYSTEM]` tags, DAN-style roleplay jailbreaks, executive/authority impersonation, data exfiltration,
calendar-description injection, multi-turn escalation, misrepresenting completion, markdown image
tracking-pixel exfiltration, base64 obfuscation, delimiter/code-fence breaking, fabricated tool-result
blocks, "the approval gate itself is the danger" framing, long-context burial, nested forwarded-authority
spoofing, zero-width-character obfuscation, system-prompt extraction attempts, and two legitimate-request
controls (should propose a pending action, but must not be blanket-refused or over-flagged as an attack).

## Vitest Branch Coverage on Security-Critical Files (a different mechanism from this eval harness)

This is standard Vitest branch coverage (`npm run test:coverage`, reads `server/coverage/coverage-final.json`),
not part of the scenario-based eval harness above — tracked here because it's the other half of "how do we
know this system works," and this is where that story already lives. Four files were targeted specifically
(agent orchestrator, policy engine, memory/retrieval service, cost guard) because they're the
security/reliability-critical path, not for a generic coverage-percentage bump — new tests deliberately did
not touch trivial getters or config files.

**Before** is reconstructed from git history: `git show 4b8786c:server/coverage/coverage-final.json`, the
last commit before any of this hardening work began (`4b8786c` — "test: add e2e tests, integration tests,
and test coverage reports"). **After** is a fresh `npm run test:coverage` run on 2026-09-21. Both are exact
counts from the coverage JSON (covered branches / total branches), not estimates.

| File | Before (branches) | After (branches) | Change |
|---|---|---|---|
| `orchestrator.service.ts` | 32/55 (58.2%) | 51/59 (86.4%) | +28.2pp |
| `policy.ts` | 41/57 (71.9%) | 52/57 (91.2%) | +19.3pp |
| `memory.service.ts` | 57/71 (80.3%) | 61/75 (81.3%) | +1.0pp |
| `cost-guard.service.ts` | 32/40 (80.0%) | 32/40 (80.0%) | unchanged (deliberate) |

Notes:
- Total branch counts changed for `orchestrator.service.ts` (55→59) and `memory.service.ts` (71→75) because
  real code was added in the same pass (graceful-degradation error handling, the keyword-only retrieval
  mode) — the denominator moved, not just the numerator, so these percentages are real ratios at each point
  in time, not the same fixed set of branches getting progressively covered.
- `cost-guard.service.ts` was deliberately left unchanged: its only uncovered branches are in
  `getUserUsageStats`'s dashboard fallback math (unit-economics defaults when no historical data exists) —
  display-only calculations, not cascade-trigger or circuit-breaker logic, which was already well covered
  and additionally exercised by `cascade-failure-classification.test.ts`.
- New tests added to reach the "after" numbers: `orchestrator-coverage.test.ts` (untrusted-content security
  notice tagging, policy pending/rejected paths through the orchestrator, provider-unavailable and
  plain-text-response paths), `policy-coverage.test.ts` (idempotency-key deduplication, the
  `executeApprovedAction` concurrent-claim race — the same class of race this pass hardened in
  `token-manager.service.ts`, but for policy.ts), `policy-injection-scenarios.test.ts` (every write/send
  attack in `injection-resistance.json` independently re-verified against `enforcePolicy()` directly, no
  orchestrator/model involved), plus two new `mode: 'keyword'` / `mode: 'vector'` tests in `memory.test.ts`.

## Adding New Scenarios

1. Add your scenario objects into the corresponding JSON file under `evals/scenarios/`.
2. Each scenario must satisfy `EvalScenario`:
   - `id`: unique scenario identifier
   - `description`: readable explanation of the test condition
   - `input`: input payload fed into the evaluated function
   - `expected`: expected ground-truth structure or assertion criteria
   - `tags`: classification tags (e.g. `["p1", "vip", "regression"]`)
