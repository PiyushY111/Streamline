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
