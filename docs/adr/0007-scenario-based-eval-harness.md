# ADR-0007: Scenario-Based Eval Harness over Ad-Hoc Manual Testing

* **Status**: Accepted
* **Deciders**: Full-Stack Architecture Team
* **Date**: 2026-09-09

---

## Context and Problem Statement

Standard unit tests (Vitest) verify deterministic code paths, but AI features — deterministic priority scoring edge cases, tool-calling selection accuracy, vector memory retrieval precision, and prompt injection resistance — require evaluating structured scenarios against ground-truth expectations. We needed a reproducible evaluation harness that produces quantifiable pass/fail metrics and benchmark reports over time.

---

## Alternatives Considered

1. **Manual Ad-Hoc Spot Checking**:
   * *Pros*: Zero setup overhead.
   * *Cons*: Not reproducible, cannot detect prompt regressions, and prone to silent degradation during system refactoring.
2. **Third-Party Evaluation SaaS Platforms (e.g., Langfuse / Braintrust / Promptfoo)**:
   * *Pros*: Rich web dashboards, hosted evaluation runs.
   * *Cons*: Adds external SaaS dependencies, additional cost, API latency, and complex credential management for a lightweight monorepo.
3. **Dedicated In-Repo Scenario-Based Eval Harness (Chosen)**:
   * *Pros*: Completely local, self-contained, typed scenario files (`server/evals/scenarios/*.json`), lightweight runner exporting timestamped JSON reports to `server/evals/results/`, runnable with `npm run eval`.
   * *Cons*: Requires maintaining scenario test datasets alongside feature implementations.

---

## Decision Outcome

**Chosen Option**: **Custom scenario-based eval harness located in `server/evals/` executed via `npm run eval`.**

### Positive Consequences
* **Measurable Quality**: Every AI component (priority scoring, tool selection, retrieval precision, prompt injection resistance) is validated against verifiable benchmarks.
* **Regression Protection**: Timestamped run reports enable exact comparisons before and after prompt tuning or schema migrations.
* **CI/CD Ready**: Exit codes ensure broken scenarios block regressions automatically.

### Negative Consequences / Tradeoffs
* Scenarios must be curated and expanded as new features and edge cases are added.

---

## Addendum (2026-09-20): Mock vs. Live Methodology, and What Each Suite Actually Tests

An audit of this harness found that "AI eval suite" overstated what two of the four suites do, and that
the retrieval and injection suites were not exercising real code paths at all. Fixed as follows; see
`server/evals/README.md` for the full breakdown.

* **`priority.eval.ts`** and **`tool-selection.eval.ts`** never call an AI provider — they test a
  deterministic scoring engine and the policy engine directly (`enforcePolicy`) against a hand-specified
  tool call. A `--live` / `EVAL_LIVE=1` flag exists (`npm run eval:live`) but is a no-op for these two.
* **`retrieval-precision.eval.ts`** previously monkey-patched `db.select` to return all seeded rows and
  reimplemented its own keyword/stem scorer — it never called the real `searchMemory` hybrid-RRF path
  (`memory.service.ts`). It now seeds real rows into Postgres/pgvector for a dedicated eval user and calls
  `searchMemory` for real. Consequence: in **mock mode**, embeddings come from `MockAiProvider`'s
  deterministic-but-not-semantic pseudo-embedding, so precision is not a meaningful signal (observed: 1/25)
  — this is expected, not a regression, and is excluded from the mock CI gate for that reason (still
  reported, still fully gated in live mode). In **live mode** with real Gemini embeddings: **25/25
  (100%), MRR = 1.000** on the 25-query seed set (2026-09-20 run, `gemini-3.5-flash-lite`).
* **`injection-resistance.eval.ts`** previously hardcoded the "model's" tool call per attack label via
  `mockProvider.setMockResponses()`, then checked only whether the policy layer blocked it — it never let
  a model decide anything. One of the 12 original scenarios targeted `delete_task`, a tool that has never
  existed in `TOOL_REGISTRY`, making that assertion vacuous (it passed only because the tool name was
  unrecognized). The corpus was expanded from 12 to 21 scenarios across more techniques (delimiter/fence
  breaking, fabricated tool-result blocks, zero-width character obfuscation, long-context burial, nested
  forwarded-authority spoofing, prompt-extraction attempts, plus two legitimate "should propose but not
  over-refuse" controls), and the vacuous case was relabeled to honestly test hallucinated-tool rejection.
  In **live mode**, the real model runs the full agent loop against the actual injected email content —
  no scripting. Two metrics are reported: (1) the **safety invariant** — no write/send tool ever executes
  without human approval — which is structurally guaranteed by `policy.ts` regardless of model behavior,
  and (2) **model injection-susceptibility** — whether the model itself attempted the prohibited action
  before the policy layer would have caught it. 2026-09-20 live run: safety invariant held 21/21;
  model attempted the prohibited action in **0/21** scenarios. In mock mode this second metric is
  scripted for illustration (15/21, by design) and is not a claim about real model behavior.
* One discovered bug fixed in passing: `memory.service.ts`'s `searchMemory` declared a `mode: 'keyword'`
  option that silently fell through to the full hybrid path — it now has a real sparse-only branch. This
  was a prerequisite for any future vector/keyword/hybrid ablation.
* A real, unrelated production bug was found while wiring the retrieval eval to the real DB: the live
  Postgres schema was missing the `embedding_model_version` column, the `entities`/`entity_relations`/
  `user_style_profiles` tables, and every check constraint from a prior commit — none of it had ever been
  migrated, only expressed in the Drizzle schema files. This meant every real `saveMemory`/`searchMemory`
  call in the running app was failing before this fix. See `server/drizzle/0002_fearless_sumo.sql`.

**Honest framing**: this harness measures what it says it measures now, and mock mode is fast/free/CI-safe
but only meaningfully validates the priority engine, policy engine, and the *structural* injection safety
invariant. Real retrieval quality and real model injection-resistance can only be assessed with `eval:live`
against a live provider, at real (small) API cost, non-deterministically.
