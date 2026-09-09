# ADR-0009: Exponential Urgency Decay and DAG Prioritization over LLM-Based Task Ranking

## Status
**Accepted** — 2026-09-09

---

## Context
In productivity systems, ranking and selecting the "next best action" for an executive or engineer is critical. Traditional AI productivity apps frequently invoke an LLM (such as GPT-4o or Gemini 1.5 Pro) with a large prompt containing dozens of user tasks and calendar events to ask: *"Which task should the user do next?"*

While conversational LLM ranking appears flexible, it introduces severe architectural shortcomings:
1. **Unbounded Latency**: LLM prompts with 50+ tasks take 1,500ms–4,000ms to complete, causing visible lag whenever a user opens their task list or checks off an item.
2. **Non-Determinism & Instability**: LLMs can reshuffle task orders between page refreshes without any underlying change in due dates or priorities, destroying user trust.
3. **Circular Dependencies & Halting**: LLMs frequently fail to detect circular task dependencies ($A \to B \to A$) or hallucinate impossible execution sequences.
4. **Token Cost & Rate Limits**: Scoring 50 tasks multiple times per day across active users incurs compounding API costs and risks hitting model rate limits during peak workday hours.

---

## Decision
We decided to implement a **purely deterministic, zero-LLM priority and planning engine** in TypeScript based on:
1. **5-Factor Weighted Formula**:
   $$\text{Score} = w_u \cdot \text{Urgency} + w_i \cdot \text{Importance} + w_p \cdot \text{Proximity} + w_d \cdot \text{DependencyImpact} + w_c \cdot \text{ContextFit}$$
2. **Exponential Urgency Decay**:
   $$\text{Urgency}(t) = e^{-\Delta t / 48}$$
   where $\Delta t$ is the hours remaining until deadline. Overdue items immediately score $1.0$, while tasks due in 48 hours score $\approx 0.37$, smoothly accelerating as the deadline approaches.
3. **Directed Acyclic Graph (DAG) & Cycle Detection**:
   - Uses Kahn's topological sorting algorithm ($O(V + E)$) to detect circular dependencies gracefully without infinite loops.
   - Computes transitive downstream leverage ($d_{\text{direct}} + 0.5 \cdot d_{\text{indirect}}$) to boost tasks that unblock critical workstreams.
   - Strictly isolates blocked tasks (`isBlocked: true`) with a 60% dampener, preventing unexecutable recommendations.
4. **Smart Calendar Slot Matching**:
   - Identifies free gaps between scheduled events taking into account **10-minute transition buffers** before and after meetings.
   - Evaluates context fit score ($w_c$) based on task estimated duration vs. the upcoming calendar window.
5. **Configurable Presets**:
   - `balanced` (30/25/20/15/10)
   - `deadline` (45/10/35/5/5)
   - `deep_work` (15/40/10/25/10)
   - `quick_wins` (20/25/10/5/40)

---

## Consequences

### Positive
- **Instant Execution**: Priority calculation for 100+ tasks takes $< 5\text{ ms}$, enabling instant UI recalculations on the client.
- **Zero Cost & Zero LLM Dependence**: Runs 100% on local server compute without third-party API dependencies or API keys.
- **Explainability**: Every task receives transparent plain-language reasoning pills (e.g. `⚠️ Overdue deadline`, `🔓 Unblocks 2 work items`, `🎯 Fits your 45m window`) derived directly from formula sub-scores.
- **Rigorous Testability**: Governed by an automated benchmark evaluation suite (`server/evals/scenarios/priority-scenarios.json`) ensuring 100% scenario accuracy across edge cases.

### Negative / Trade-offs
- Requires explicit metadata (`importance`, `estimatedMinutes`, `dependencies`, `dueAt`) to maximize effectiveness. Tasks missing estimates fall back to neutral heuristic defaults (0.5 importance, 1.0 neutral context fit).
