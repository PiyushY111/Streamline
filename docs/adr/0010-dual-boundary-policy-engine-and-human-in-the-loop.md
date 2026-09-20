# ADR-0010: Dual-Boundary Policy Engine and Human-in-the-Loop Safeguards for Autonomous AI Tool Calling

## Status
**Accepted** — 2026-09-09

---

## Context
As LLMs evolve with native function calling capabilities (Gemini, OpenAI GPT-4o, Anthropic Claude, Groq Llama 3), AI agents can interact directly with external environments, calendars, task databases, and communication channels.

However, giving an LLM unconstrained, direct execution authority over write operations creates severe security and operational vulnerabilities:
1. **Prompt Injection & Indirect Jailbreaks**: Adversarial instructions hidden within external data (e.g., incoming email bodies, meeting invitations, web content) can hijack the LLM’s context and instruct it to execute unauthorized destructive actions.
2. **Hallucinated Arguments & Accidental Mutations**: Models can hallucinate invalid dates, wrong email recipients, or unintended task deletions.
3. **Loss of Blast-Radius Visibility**: Users cannot verify the consequence of an action before it is already applied to their calendar, email outbox, or database.
4. **Vendor Lock-In**: Many tool-calling implementations bind tightly to a single proprietary SDK format (e.g., OpenAI Assistant API or Gemini Chat Session), making multi-model routing difficult.

---

## Decision
We decided to architect a **Provider-Agnostic Dual-Boundary Policy Engine** governed by a strict **Human-in-the-Loop (HITL)** policy:

### 1. Dual-Boundary Tool Classification
Every tool registered in the system is explicitly categorized into one of three permission classes:
- **`read`** (`get_tasks`, `find_free_slots`, `draft_email`, `search_memory`): Safe queries that inspect state or produce non-destructive drafts. Permitted to execute inline immediately and return data to the LLM turn loop.
- **`write`** (`create_calendar_event`, `create_task`, `save_memory`): State-modifying operations on the user's primary database or calendar.
- **`send`** (`send_email`): External communication dispatching messages to third parties.

### 2. Strict Staging of Write & Send Tools
Under no circumstances may a `write` or `send` tool execute inline during an agent conversational turn. Instead:
- The policy engine automatically formats an **`impact_preview`** detailing the exact consequences (e.g. event time, recipient email, task priority).
- A row is inserted into the `pending_actions` PostgreSQL table with a status of `'pending'`, an expiration timestamp (`expires_at = now + 24h`), and an optional `idempotency_key`.
- The LLM receives a synthesized tool result informing it that the action has been staged for user approval.

### 3. Isolated Approval Execution with Row-Level Locks
Execution of a staged action occurs strictly through an authenticated human approval endpoint (`POST /api/agent/actions/:id/approve`):
- Executes within an atomic database transaction using `SELECT ... FOR UPDATE` row locks to prevent double-clicks, race conditions, or replay attacks.
- Strict ownership verification (`WHERE id = :id AND user_id = :userId`) prevents cross-user authorization bypass.
- Enforces a 24-hour TTL expiration check.
- Invokes the concrete service with recorded audit log events (`agent.tool.executed.*` or `agent.tool.failed.*`).

### 4. Input Sanitization & Pre-Execution Zod Validation
All tool calls proposed by any AI provider pass through strict Zod schemas before touching any internal service. Hallucinated tool names or malformed arguments are rejected before reaching execution.

### 5. Multi-Turn Orchestration & Safety Guards
- **Bounded Iterations**: Tool execution loops are hard-capped at `MAX_TOOL_TURNS = 5` to prevent infinite loops.
- **Cost-Guard Circuit Breaker**: Pre-flight spend limits check token budgets before any turn begins.
- **Provider Agnosticism**: Abstracted behind `AiProvider.chatWithTools(...)`, enabling hot-swapping between Gemini, OpenAI, Groq, and offline Mock providers.

---

## Consequences

### Positive
- **No Unauthorized Side Effects Without Human Sign-Off**: Write/send tool calls are queued for approval regardless of why the model proposed them — including prompt injection or an autonomous model mistake. This is containment (nothing executes without approval), not a claim that injection or mistakes can't happen upstream of the queue.
- **Auditability**: Every tool proposal, queueing event, user approval, rejection, and execution is permanently tracked in `audit_logs` and `pending_actions`.
- **User Confidence**: Users see structured, clear approval cards before consequential actions occur.
- **22/22 Scenarios Passing**: `evals/tool-selection.eval.ts` — read queries, write staging, approval flows, schema rejections, and injection-shaped attempts, all calling `enforcePolicy()` directly.

### Negative / Trade-offs
- **Human Latency**: Write actions require an explicit click or confirmation from the user in the UI, slightly increasing interaction friction in exchange for total security.
