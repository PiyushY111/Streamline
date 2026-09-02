# Gemini AI Intelligence Pipeline

Streamline integrates Google's latest **Gemini Foundation Models** via the official `@google/genai` SDK to transform static emails and notifications into an autonomous, actionable personal intelligence hub.

---

## 1. Multi-Model Cascade Architecture

To ensure sub-second response times, 99.9% uptime, and zero-cost resilience under free/paid API limits, Streamline implements an intelligent **Multi-Model Cascade Engine**.

```mermaid
graph TD
    Request["Incoming AI Request (Triage / Reply / Digest)"] --> Model1["Primary: gemini-3.5-flash-lite (Latency: ~680ms)"]
    Model1 -->|Success (200 OK)| Result["Structured JSON / SSE Stream"]
    Model1 -->|Rate Limit / Error| Model2["Fallback 1: gemini-3.6-flash"]
    Model2 -->|Success| Result
    Model2 -->|Rate Limit / Error| Model3["Fallback 2: gemini-3.1-flash-lite"]
    Model3 -->|Success| Result
    Model3 -->|Rate Limit / Error| Model4["Fallback 3: gemini-3.7-flash"]
    Model4 -->|Success| Result
    Model4 -->|All Candidates Failed| Heuristic["Deterministic Heuristic Fallback Engine"]
    Heuristic --> Result
```

### Model Performance Benchmarks:
* **`gemini-3.5-flash-lite`**: **681 ms** average latency (Default for all real-time triage and reply generation).
* **`gemini-3.6-flash`**: **1.98 s** average latency (Deep newsletter summarization & multi-message synthesis).
* **`gemini-3.1-pro-preview`**: High reasoning model reserved for complex scheduling conflict resolution.

---

## 2. Core AI Capabilities

### A. Real-Time Email Triage & Classification
Whenever an email is ingested from Google, the `ai-email-triage-queue` passes the message body, sender, and recipient metadata to Gemini with a strict JSON schema contract:

```typescript
// Structured Schema for Gemini Output
{
  priority: "p1_urgent" | "p2_important" | "p3_updates" | "p4_newsletter" | "p5_low",
  urgencyScore: number, // 1 to 100
  category: "action_required" | "direct_message" | "notification" | "newsletter" | "receipt",
  oneSentenceSummary: string,
  newsletterTopic: "🎓 Academics" | "🚀 Tech & AI" | "💼 DevClub" | "👥 Community" | "📊 Finance",
  sentiment: "positive" | "neutral" | "negative",
  extractedTasks: [
    {
      id: string,
      title: string,
      priority: "high" | "medium" | "low",
      dueDate: string | null
    }
  ]
}
```

### B. Streaming AI Reply Drafter
* **Latency**: Starts streaming tokens within **~400ms**.
* **Context Awareness**: Gathers the entire thread history (all prior sender/recipient turns) so Gemini drafts contextual replies matching the active thread conversation.
* **Tone Modulation**:
  * **Professional**: Formal, direct, and action-oriented.
  * **Friendly**: Warm, conversational, and enthusiastic.
  * **Concise**: 1-2 sentence quick acknowledgement and decision.
  * **Custom Instructions**: Freeform user prompt (e.g., *"Accept the meeting for Thursday 2 PM but ask for the agenda beforehand"*).

### C. Daily Executive & Newsletter Digest
Every morning (configurable in Settings), the `daily-digest-cron-queue` aggregates all newsletters, promotional subscriptions, and urgent action items received over the last 24 hours.

Gemini generates a structured executive briefing containing:
1. **Executive Greeting**: A 2-sentence situational awareness opening.
2. **Operational Schedule Summary**: High-level readiness context.
3. **Thematic Newsletter Clusters**: Groups 20+ newsletters into clean topic tabs (e.g. *Tech & AI*, *Macro Economy*) with punchy bullet points and clickable source links.
4. **Action Item Radar**: Consolidates open deliverables requiring user decision.

---

## 3. AI Task Radar & 1-Click Task Conversion

```mermaid
sequenceDiagram
    participant Email as Incoming Email
    participant Gemini as Gemini AI
    participant DB as Neon DB (AI Metadata)
    participant UI as Task Radar Widget
    participant Tasks as Streamline Tasks Table

    Email->>Gemini: Parse & Triage Email
    Gemini->>DB: Extract Task: "Submit CN Contest 1 Guidelines"
    DB->>UI: Render in AI Task Radar
    Note over UI: User clicks "Accept / Convert to Task"
    UI->>Tasks: POST /api/ai/tasks/convert
    Tasks->>DB: INSERT INTO tasks (title, priority, dueAt)
    Tasks->>DB: UPDATE email_ai_metadata SET isConverted = true
    Tasks-->>UI: 201 Created (Instant UI Checkmark)
```
