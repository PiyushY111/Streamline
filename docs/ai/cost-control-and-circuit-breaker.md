# AI Token Tracking, Cost Control & Circuit Breaker Architecture

In production AI applications, uncontrolled LLM consumption can result in exponential API billing spikes, quota exhaustion (HTTP 429), and cascading downtime. Streamline implements an autonomous **AI Cost Guard & Circuit Breaker Engine** to track real-time token consumption, compute USD costs per user, and automatically protect against runaway usage.

---

## 1. Architectural Overview

```mermaid
graph TD
    Request["User / Worker AI Request"] --> CircuitCheck{"Circuit Breaker Check<br/>(Daily Token & Cost Quota)"}
    
    CircuitCheck -->|Within Budget Limits| Dispatch["Dispatch to Gemini Multi-Model Cascade"]
    CircuitCheck -->|Budget Exceeded (Tripped)| Fallback["Deterministic Heuristic Fallback / Template Draft"]
    
    Dispatch --> ModelExec["Execute gemini-3.5-flash-lite"]
    ModelExec --> UsageRecord["Asynchronously Persist Tokens & Cost to PostgreSQL (ai_token_usage)"]
    ModelExec --> Response["Structured JSON / SSE Output"]
    Fallback --> Response
```

---

## 2. Gemini Foundation Model Pricing Matrix

Streamline dynamically calculates exact USD costs based on input and output token consumption:

| Model ID | Role in System | Prompt Price (per 1M tokens) | Completion Price (per 1M tokens) |
| :--- | :--- | :--- | :--- |
| **`gemini-3.5-flash-lite`** | Primary Email Triage & Streaming Reply Drafter | **\$0.075** | **\$0.30** |
| **`gemini-3.6-flash`** | Newsletter Synthesis & Thread Summaries | **\$0.10** | **\$0.40** |
| **`gemini-3.1-flash-lite`** | Lightweight Secondary Cascade Fallback | **\$0.075** | **\$0.30** |
| **`gemini-3.7-flash`** | Advanced Reasoning Fallback | **\$0.15** | **\$0.60** |
| **`gemini-3.1-pro-preview`**| Complex Scheduling Conflict Resolution | **\$1.25** | **\$5.00** |

### Mathematical Cost Formula:
$$\text{Cost}_{\text{USD}} = \left( \frac{\text{Prompt Tokens}}{1,000,000} \times \text{Price}_{\text{Prompt}} \right) + \left( \frac{\text{Completion Tokens}}{1,000,000} \times \text{Price}_{\text{Completion}} \right)$$

---

## 3. Circuit Breaker & Rate Limiting Thresholds

Streamline enforces per-user daily budget guardrails configured in `cost-guard.service.ts`:

* **`DAILY_TOKEN_LIMIT`**: `250,000 tokens / user / day`
* **`DAILY_COST_LIMIT_USD`**: `\$0.50 / user / day`

### Circuit Breaker Tripping Behavior:
1. **Background Email Triage**: When the circuit trips, the background worker automatically routes incoming messages through the **local deterministic heuristic classifier** (regular expressions and MIME parsing). Zero external AI calls are made, guaranteeing uninterrupted email ingestion at zero cost.
2. **Streaming Reply Drafter**: When the circuit trips, the UI modal delivers a polite default template draft while logging the budget event to user audit records.
3. **Daily Executive Digest**: Falls back to deterministic clustering of recent newsletters and high-priority action items.

---

## 4. User Token Analytics API (`GET /api/ai/usage`)

Authenticated users and administrators can monitor their real-time AI resource consumption:

### Sample Response:
```json
{
  "success": true,
  "data": {
    "today": {
      "tokens": 42150,
      "costUsd": 0.004125,
      "tokenLimit": 250000,
      "costLimitUsd": 0.50,
      "percentUsed": 16.86
    },
    "last30Days": {
      "tokens": 894200,
      "costUsd": 0.087210
    },
    "breakdown": [
      { "operation": "triage", "tokens": 620100, "costUsd": 0.051200 },
      { "operation": "reply_draft", "tokens": 194100, "costUsd": 0.024800 },
      { "operation": "digest", "tokens": 80000, "costUsd": 0.011210 }
    ],
    "circuitBreaker": {
      "isTripped": false
    }
  }
}
```
