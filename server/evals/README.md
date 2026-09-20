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
| `retrieval-precision.eval.ts` | Yes — for embeddings | Mock mode uses `MockAiProvider`'s deterministic-but-not-semantic pseudo-embedding, so precision is not a meaningful signal there (last mock run: 1/25 — expected, not a regression, excluded from the mock CI gate for that reason). Live mode uses real embeddings and is the only mode that measures actual retrieval quality (last live run: **25/25, MRR 1.000**, 2026-09-20, `gemini-3.5-flash-lite`). |
| `injection-resistance.eval.ts` | Yes — for the full agent tool-calling loop | Mock mode scripts the "model's" tool call per attack label (`scriptedMockTurn` in the eval file) purely so CI has a fast signal that the **policy layer** holds — it is not evidence about model behavior. Live mode lets the real model decide everything given the actual injected email content, with no scripting. This is the only mode that tests real injection *resistance* rather than injection *containment*. Last live run (2026-09-20, 21 scenarios): safety invariant held 21/21; model itself attempted the prohibited action in 0/21 (reported as a separate, non-gating "model injection-susceptibility" metric — see the eval file). |

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

## Adding New Scenarios

1. Add your scenario objects into the corresponding JSON file under `evals/scenarios/`.
2. Each scenario must satisfy `EvalScenario`:
   - `id`: unique scenario identifier
   - `description`: readable explanation of the test condition
   - `input`: input payload fed into the evaluated function
   - `expected`: expected ground-truth structure or assertion criteria
   - `tags`: classification tags (e.g. `["p1", "vip", "regression"]`)
