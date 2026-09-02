# ADR-0003: Multi-Model Cascade Fallback vs Single-Model Exponential Retry

* **Status**: Accepted
* **Deciders**: AI & Backend Team
* **Date**: 2026-08-25

---

## Context and Problem Statement

LLM APIs are prone to rate limits (HTTP 429), regional capacity outages (HTTP 503), model deprecations, and upstream token quotas (especially on free/standard API tiers). Relying on a single model with exponential backoff causes severe latency spikes for user-facing actions (e.g. streaming draft generation) and stalls background email triage.

---

## Alternatives Considered

1. **Single Model with Aggressive Exponential Backoff**:
   * *Pros*: Simple code path, predictable prompt outputs.
   * *Cons*: Retrying a throttled or unavailable model introduces multi-second delays before failing; users experience UI freezes during reply drafting.
2. **Load Balancing Across Multiple API Providers (e.g. Gemini + OpenAI + Anthropic)**:
   * *Pros*: High redundancy across distinct cloud providers.
   * *Cons*: Requires managing multiple API keys and subscriptions; differences in prompt formatting and JSON schema enforcement introduce non-deterministic triage bugs.
3. **Multi-Model Cascade with Heuristic Degradation (Chosen)**:
   * *Pros*:
     * Tiers lightweight, cost-effective models (`gemini-3.5-flash-lite`) first.
     * Automatically fails over to subsequent candidate models (`gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-3.7-flash`) within milliseconds of an error without exponential backoff waiting.
     * Includes a local deterministic rule-based heuristic parser if all external AI endpoints are exhausted, guaranteeing the system never crashes or halts email ingestion.

---

## Decision Outcome

**Chosen Option**: **Tiered Multi-Model Cascade within Google Gemini family + Heuristic Fallback**.

### Positive Consequences
* **Immediate Failover**: Upstream 429/503 errors trigger instantaneous candidate retry without sleep/backoff delays.
* **Cost & Quota Efficiency**: High-volume triage tasks use the lowest-cost model (`flash-lite`) while falling back to deeper models only when necessary.
* **Graceful Degradation**: If internet access is lost or API quota is completely depleted, basic priority categorization (`p1` to `p4`) and domain clustering still succeed via local regular expression heuristics.
