# Streamline — Autonomous AI Personal Productivity OS

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black.svg)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-Neon%20Postgres-00E599.svg)](https://neon.tech/)
[![Vector Search](https://img.shields.io/badge/Vector-pgvector%20HNSW-7928CA.svg)](https://github.com/pgvector/pgvector)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%203.5%20%7C%203.6-4285F4.svg)](https://ai.google.dev/)
[![Queues](https://img.shields.io/badge/Queues-BullMQ%20%7C%20Redis-DC382D.svg)](https://bullmq.io/)
[![Observability](https://img.shields.io/badge/Telemetry-OpenTelemetry%20Spans-F5A623.svg)](https://opentelemetry.io/)
[![Security](https://img.shields.io/badge/Security-Dual--Boundary%20Shield-10B981.svg)](#-5-bank-grade-security--prompt-injection-defense)
[![Evals](https://img.shields.io/badge/Evals-Scenario%20Benchmark%20Suite-6366F1.svg)](#-automated-eval-harness--benchmarks)

**An autonomous, multi-tenant personal operating system unifying multi-account Gmail, Google Calendar, semantic memory, and proactive AI agents with bank-grade policy guardrails into a single high-performance dashboard.**

[Explore Documentation](./docs/README.md) · [Architecture Overview](./docs/architecture/system-overview.md) · [REST API Specs](./docs/api/endpoints.md) · [ADRs](./docs/adr/README.md) · [Developer Setup](./docs/development/setup-guide.md)

</div>

---

## ⚡ Executive Overview

**Streamline** transforms personal productivity by aggregating fragmented Google Workspace accounts (Work, Personal, University) into a single, high-performance command center. 

Beyond standard email clients, Streamline acts as an **autonomous personal operating system**:
* **ReAct Agent Runtime & Tool Orchestrator**: An interactive multi-turn agent capable of scheduling events, drafting emails, managing tasks, and recalling memories using explicit thought signatures and multi-step tool execution loops.
* **OAuth 2.0 Token Lifecycle & Multi-Account Credential Vault**: Proactive 5-minute expiry buffer checks, single-flight concurrency mutex locks (preventing thundering herd refresh storms across parallel BullMQ workers), AES-256-GCM encryption, and automated `invalid_grant` revocation handling.
* **Dual-Boundary Policy Engine & Human-in-the-Loop Shield**: Automated interception of state-mutating actions (`send_email`, `create_calendar_event`, `create_task`) requiring cryptographic human review before execution.
* **Policy-Layer Prompt Injection Defense**: Structural isolation of untrusted external content via delimiter neutralization, preventing indirect prompt injections from hijacking agent execution.
* **pgvector Hybrid RAG & Semantic Memory Engine**: Continuous semantic recall across 3 memory classes (*User Preferences*, *Confirmed Decisions*, *Project Facts*) via Neon pgvector HNSW cosine distance fused with PostgreSQL `tsvector` full-text search via Reciprocal Rank Fusion ($k=60$).
* **OpenTelemetry-Compliant Observability**: Real-time waterfall trace profiler tracking per-step latencies, model vs. tool overhead, and exact token/USD cost attribution via live SSE streams.
* **DAG Task Dependency Scheduler & Topological Urgency Engine**: Topological sorting with cycle detection (Kahn's / DFS algorithm) and exponential urgency decay scoring ($e^{-\Delta t / 48}$) to deterministically select your next best task against Google Calendar free slots.
* **AI Cost Guard & Circuit Breaker**: Autonomous per-user daily token budgets and USD spend limits with automatic tripping mechanisms.

---

## 🏛️ System Architecture

### Tier 1: 5-Box Executive Architecture (10-Second High-Level Scan)

```mermaid
flowchart LR
    subgraph B1 ["1. Client & Streaming UI"]
        NextJS["Next.js 15 (React 19)\nSSE Waterfall & Drafter Stream"]
    end

    subgraph B2 ["2. Security & Token Gateway"]
        Gateway["Express 5 REST API\nToken Lifecycle Mutex\nAES-256-GCM Vault"]
    end

    subgraph B3 ["3. ReAct Agent Core"]
        AgentCore["ReAct Execution Runtime\nGemini Cascade Fallback\nHITL Dual-Boundary Shield"]
    end

    subgraph B4 ["4. Distributed Async Queues"]
        AsyncQ["BullMQ 5.x + Redis Cluster\nSync, Triage & Digest Workers"]
    end

    subgraph B5 ["5. Hybrid Storage & Vectors"]
        DBStore["Neon Serverless Postgres\npgvector HNSW Cosine Search\nFull-Text tsvector Engine"]
    end

    B1 <-->|HTTP / SSE| B2
    B2 <-->|Enqueued Jobs| B4
    B2 <-->|Read / Write| B5
    B4 <-->|Persistence & Vectors| B5
    B2 <-->|Agent Sessions| B3
    B3 <-->|Context Recall & Mutex| B5
```

---

### Tier 2: Deep-Dive Distributed Systems Topology & Dataflows

```mermaid
graph TD
    subgraph MultiAccount ["Multi-Account Ingestion Layer"]
        G1["Work Gmail & Calendar"]
        G2["Personal Gmail & Calendar"]
        G3["University / Org Mail"]
    end

    subgraph TokenLifecycle ["OAuth 2.0 Token Lifecycle & Credential Vault"]
        TokenManager["GoogleTokenManager\n(Single-Flight Concurrency Mutex)"]
        AES["AES-256-GCM Encrypted Vault\n(Unique IV per secret)"]
        ExpiryGuard["Proactive Expiry Guard\n(<5m buffer + invalid_grant handling)"]
    end

    subgraph SecurityCore ["Policy & Isolation Layer"]
        PolicyEngine["Dual-Boundary Policy Engine"]
        Shield["Pending Action Approval Shield\n(Cryptographic Human Review)"]
        InjectionShield["XML Delimiter Neutralizer\n(<untrusted_external_content>)"]
    end

    subgraph AsyncEngine ["Distributed Async Engine"]
        BullMQ["BullMQ 5.x Job Queues"]
        RedisBus["Redis Cache & Event Bus"]
        SyncWorker["Account Sync Worker"]
        TriageWorker["AI Email Triage Worker"]
        DigestWorker["Daily Digest Worker"]
    end

    subgraph StorageEngine ["Hybrid Persistence & Vector Engine"]
        NeonDB[("Neon Serverless Postgres")]
        PGVector[("pgvector HNSW Vector Store\n(768-dim cosine distance)")]
        TSVector[("PostgreSQL tsvector Index\n(Sparse BM25 Keyword Search)")]
    end

    subgraph GeminiAI ["AI Intelligence & Orchestration Runtime"]
        AgentRuntime["ReAct Agent Runtime\n(Multi-Turn Reasoning & Tools)"]
        Cascade["Multi-Model Cascade Fallback\n(Gemini 3.5 Lite → 3.6 Flash)"]
        CostGuard["AI Spend Circuit Breaker"]
        Tools["Tool Registry\n(Email, Calendar, Tasks, Memory)"]
        OTel["OpenTelemetry GenAI Span Profiler"]
    end

    subgraph UnifiedOS ["Streamline Personal OS Dashboard"]
        Inbox["Unified Multi-Account Inbox"]
        Drafter["Streaming Contextual Drafter"]
        CalendarUI["Integrated Agenda & Slot Finder"]
        TaskDAG["DAG Task Dependency Scheduler"]
        RAGInspector["Hybrid RAG Retrieval Inspector"]
        SecDash["Security & Injection Test Lab"]
        TraceUI["Live Decision Trace Waterfall"]
    end

    G1 & G2 & G3 --> TokenManager
    TokenManager <--> ExpiryGuard
    TokenManager <--> AES
    TokenManager --> BullMQ
    BullMQ --> RedisBus
    RedisBus --> SyncWorker & TriageWorker & DigestWorker
    SyncWorker --> NeonDB
    TriageWorker & DigestWorker --> Cascade
    TriageWorker --> InjectionShield --> NeonDB
    NeonDB <--> PGVector & TSVector

    NeonDB & PGVector --> AgentRuntime & Cascade
    AgentRuntime --> Tools --> PolicyEngine
    PolicyEngine -->|Safe / Read-Only| Tools
    PolicyEngine -->|Mutating Action| Shield -->|User Approved| Tools
    AgentRuntime --> OTel --> TraceUI
    Cascade --> CostGuard
    Tools & Cascade --> Inbox & Drafter & CalendarUI & TaskDAG & RAGInspector & SecDash
```

---

## 🔍 Show Me The Code: Interview Follow-Up Defense Matrix

Every box in the architecture diagrams corresponds to production code. Below is the technical defense matrix detailing exact algorithms, complexity, and source references:

| Diagram Box Name | What Does This Actually Do? | Core Algorithm / Complexity | Production Code Location | Interviewer Follow-Up Defense |
| :--- | :--- | :--- | :--- | :--- |
| **OAuth 2.0 Token Lifecycle & Refresh Mutex** | Manages Google multi-account credentials, proactive refresh buffer (<5m), and serialized concurrency locking. | In-memory single-flight promise map per `accountId` ($O(1)$) | [`token-manager.service.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/google/token-manager.service.ts) | Prevents thundering herd refresh storms across parallel BullMQ workers; handles `invalid_grant` with automatic status downgrades and audit logging. |
| **ReAct Agent Runtime & Tool Execution Core** | Multi-turn reasoning loop executing registered operational tools (`gmail`, `calendar`, `tasks`, `memory`) with thought signature parsing. | ReAct pattern; regex parsing of `<thought>` signatures; deterministic step iteration | [`orchestrator.service.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/ai/agent/orchestrator.service.ts) | Parses Gemini internal reasoning blocks, evaluates max turn guardrails, and pipes live step execution to SSE streams. |
| **Dual-Boundary Policy & HITL Approval Shield** | Intercepts state-mutating operations (`send_email`, `create_calendar_event`, `create_task`) before external execution. | Two-phase commit interception; state machine (`pending` → `approved` / `rejected`) | [`policy.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/ai/agent/policy.ts) | Mutating actions write directly to the `pending_actions` table; Google Workspace API calls are strictly blocked until explicit cryptographic human authorization. |
| **pgvector Hybrid RAG & Semantic Memory Store** | Dense HNSW vector search fused with sparse PostgreSQL tsvector full-text search via Reciprocal Rank Fusion ($k=60$). | $RRF(d) = \sum \frac{1}{60 + \text{rank}}$; HNSW cosine distance (`<=>`); deduplication distance < 0.12 | [`memory.service.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/ai/memory/memory.service.ts) | Uses Neon pgvector cosine operator `<=>`; automatically supersedes conflicting memories (`supersededBy`); records access frequencies for decay modeling. |
| **DAG Dependency Scheduler & Urgency Engine** | Deterministic task prioritization via topological graph analysis, cycle detection, and exponential urgency decay. | Kahn's / DFS cycle detection ($O(V+E)$); exponential urgency decay $e^{-\Delta t / 48}$; Gaussian slot fit | [`priority.service.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/priority.service.ts) | Prevents dependency deadlocks with cycle detection; computes transitive downstream impact; factors in Google Calendar free slots for contextual fit. |
| **AI Spend Guard & Circuit Breaker** | Tracks per-user daily token consumption and USD expenditure; trips before vendor quotas are exceeded. | Leaky bucket rate limiting + atomic daily spend ledger aggregation ($O(1)$) | [`cost-guard.service.ts`](file:///Users/piyush./Desktop/Streamline/server/src/services/ai/core/cost-guard.service.ts) | Fallback from primary Gemini models to deterministic local handlers when spend exceeds configured daily limits or provider error rates spike. |

---

## ✨ Core Features

### 📬 1. Unified Multi-Account Inbox & Mailbox Management
* **Consolidated Account Feed**: Aggregate emails from multiple Google accounts into a synchronized view with zero data bleed.
* **Smart Account Badging**: Color-coded mailbox indicators identifying account sources and sender domains.
* **L1 Redis Caching**: Sub-millisecond response times for cached mailbox queries with automatic invalidation on mutations.
* **Rich Thread Viewer**: Sanitized HTML rendering with attachments, inline participant badges, and full thread history.

### 🧠 2. Gemini Autonomous Intelligence Pipeline
* **Real-Time Priority Triage (P1–P4)**:
  * `🔥 P1 Action`: Urgent deadlines, critical action items, and executive requests.
  * `💬 P2 Direct`: 1-on-1 human interpersonal correspondence.
  * `🔔 P3 Updates`: Automated notifications, security alerts, and system policies.
  * `📰 P4 News`: Subscriptions, newsletters, and digests.
* **Automated Topic Clustering**: Smart semantic pills (`🎓 Academics`, `🚀 Tech & AI`, `💼 DevClub`, `👥 Community`).
* **Streaming Reply Drafter (SSE)**: Real-time contextual reply generation supporting tone modulation (*Professional*, *Friendly*, *Concise*, *Custom Prompt*).
* **Daily Executive Digest**: Synthesized morning briefing consolidating newsletters, pending tasks, and upcoming meetings into an actionable dashboard.

### 🤖 3. ReAct Agent Runtime & Tool Orchestrator
* **Multi-Turn Decision Agent**: Natural language assistant equipped with specialized operational tools:
  * `get_email`, `send_email`, `draft_email`
  * `create_calendar_event`, `find_free_slots`
  * `create_task`, `get_tasks`
  * `save_memory`, `search_memory`
* **Thought Signatures**: Transparent agent reasoning with explicit internal reasoning steps before executing actions.
* **Dual-Boundary Policy Interception**: State-mutating operations are held in a secure `pending_actions` queue, displaying impact previews and requiring one-click user authorization before touching Google APIs.

### 🛡️ 4. Durable Memory Vault & pgvector Hybrid RAG Engine
* **3-Tier Durable Memory Architecture** ([ADR-0011](./docs/adr/0011-three-durable-memory-types-and-read-classified-storage.md)):
  * `preference`: Working styles, communication habits, and scheduling preferences.
  * `decision`: Confirmed agreements, policy rules, and explicit directives.
  * `project_fact`: System configurations, architectural constraints, and organizational context.
* **Hybrid Search Engine**: Neon PostgreSQL `pgvector` HNSW cosine similarity search combined with full-text keyword indexing.
* **Hybrid RAG Retrieval Inspector**: Live inspection interface to execute real-time vector queries, inspect retrieval latency, examine HNSW cosine distance (`<=>`), and preview exact prompt context injection.

### 🔒 5. Bank-Grade Security & Prompt Injection Defense
* **Policy-Layer Structural Enforcement** ([ADR-0012](./docs/adr/0012-policy-layer-prompt-injection-defense.md)): Untrusted external email bodies are strictly encapsulated inside `<untrusted_external_content>` XML delimiters with neutralized delimiters, eliminating prompt injection risks at the architectural level.
* **AES-256-GCM Token Encryption**: Google OAuth access and refresh tokens are encrypted at rest with unique initialization vectors and cryptographic authentication tags.
* **OAuth 2.0 with PKCE & CSRF Protection**: Strict state parameter validation, double-submit cookie verification, and zero token exposure over public APIs.
* **Penetration Testing Lab**: Interactive in-app security console with preset attack payloads (jailbreaks, fake system delimiters, roleplay DAN) to test and verify system resilience.

### 📊 6. OpenTelemetry Decision Tracing & Cost Breakdown
* **Full-Trace Waterfall Profiler**: Visual Gantt-chart timeline mapping every sub-step of agent sessions conforming to OpenTelemetry GenAI semantic conventions.
* **Latency & Cost Decomposition**: Separate measurements for model generation latency vs. tool execution overhead, with exact per-step token counts and USD expenditure tracking.
* **Live SSE Trace Streaming**: Real-time streaming updates as the agent reasons, queries tools, and checks policy guardrails.

### 📅 7. Calendar Scheduling & DAG Task Planner
* **Two-Way Google Calendar Sync**: Bidirectional sync supporting event creation, recurrence parsing, and participant conflict detection.
* **Smart Free-Slot Discovery**: Automatic scanning of calendar gaps to recommend optimal task execution windows.
* **DAG Task Dependency Engine** ([ADR-0009](./docs/adr/0009-exponential-urgency-decay-and-dag-prioritization.md)): Topological sorting, cycle detection, and exponential urgency decay scoring across configurable presets (*Balanced*, *Deadline Driven*, *Deep Work*, *Quick Wins*).

### 💰 8. AI Cost Guard & Circuit Breaker
* **Autonomous Budget Enforcement**: Configurable daily user token limits and USD cost thresholds.
* **Circuit Breaker System**: Automatically trips and falls back to deterministic local handlers if daily thresholds are exceeded or provider error rates spike.

---

## 🗺️ Dashboard & Application Routes

| Route | Page Name | Primary Capabilities |
| :--- | :--- | :--- |
| **`/inbox`** | Unified Inbox | Multi-account email stream, priority badges, thread viewer, streaming reply drafter. |
| **`/agent`** | ReAct Agent Orchestrator | Multi-turn reasoning agent, tool execution runtime, pending approval cards, thought signature inspection. |
| **`/agent/traces/[id]`** | Trace Profiler | OpenTelemetry span waterfall, step latencies, token usage, and USD cost decomposition. |
| **`/memory`** | Memory Vault & Hybrid RAG | Semantic memory records, category filters, live pgvector HNSW + tsvector Hybrid RAG retrieval inspector. |
| **`/security`** | Security Guardrails | Threat posture monitor, untrusted content shield status, live injection penetration testing. |
| **`/calendar`** | Calendar & Agenda | Synchronized multi-calendar view, free-slot finder, direct event scheduling modal. |
| **`/tasks`** | DAG Task Scheduler | Action item radar, dependency blocker tracking, exponential urgency score ranking. |
| **`/digest`** | Executive Digest | Daily synthesized morning briefing, newsletter summaries, actionable highlights. |
| **`/settings`** | System Settings | Google account connections, OAuth token lifecycle status, sync intervals, and AI cost guard limits. |

---

## 🏗 Technology Stack

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend UI** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Zustand, Lucide Icons |
| **Backend API** | Express.js 5, Node.js 18+, TypeScript, Zod, Pino Logger, Helmet, CORS, Cookie-Parser |
| **AI & LLM Orchestration** | Google Gen AI SDK (`@google/genai`), Gemini 3.5 Flash-Lite, Gemini 3.6 Flash, OpenAI-compatible provider fallback |
| **Vector Engine & RAG** | Neon PostgreSQL `pgvector` (HNSW indexing, cosine similarity), text embeddings |
| **Database & ORM** | Neon Serverless PostgreSQL, Drizzle ORM, Drizzle Kit |
| **Queues & Async Jobs** | BullMQ 5.x, Redis (ioredis), node-cron schedulers |
| **Security & Auth** | AES-256-GCM symmetric encryption, Bcrypt, JWT (`httpOnly`), Double-Submit CSRF, Rate Limiting, Secret Redactor |
| **Observability** | Custom OpenTelemetry GenAI Span Assembler, Server-Sent Events (SSE) trace streaming |
| **Testing & Evals** | Vitest test runner, Scenario-based AI eval harness (`evals/run-all.ts`) |

---

## 📚 Complete Documentation Suite

Comprehensive architectural deep-dives and guides are available in the [`/docs`](./docs/README.md) directory:

* 🗺️ [**Documentation Index**](./docs/README.md)
* 📐 [**System Architecture & Topology**](./docs/architecture/system-overview.md)
* 🗄️ [**Database Schema & pgvector Design**](./docs/architecture/database-schema.md)
* 🤖 [**Gemini AI Intelligence Pipeline**](./docs/ai/gemini-pipeline.md)
* 🛡️ [**AI Cost Control & Circuit Breaker**](./docs/ai/cost-control-and-circuit-breaker.md)
* 🔄 [**Sync Engine & BullMQ Workers**](./docs/sync/engine-and-workers.md)
* 🔐 [**Security, Authentication & Token Encryption**](./docs/security/auth-and-encryption.md)
* 🌐 [**REST API Specification**](./docs/api/endpoints.md)
* 🛠️ [**Developer Setup & Deployment Guide**](./docs/development/setup-guide.md)

### 📋 Architecture Decision Records (ADRs)
* [**ADR-0001**](./docs/adr/0001-bullmq-redis-for-async-jobs.md): BullMQ & Redis for Async Job Queues
* [**ADR-0002**](./docs/adr/0002-aes-256-gcm-application-encryption.md): Application-Level AES-256-GCM Token Encryption
* [**ADR-0003**](./docs/adr/0003-multi-model-cascade-fallback.md): Multi-Model Cascade Fallback vs Single-Model Exponential Retry
* [**ADR-0004**](./docs/adr/0004-neon-postgres-drizzle-orm.md): Neon Serverless PostgreSQL with Drizzle ORM
* [**ADR-0005**](./docs/adr/0005-sse-over-websockets-for-ai-streaming.md): Server-Sent Events (SSE) over WebSockets for AI Streaming
* [**ADR-0006**](./docs/adr/0006-pgvector-over-dedicated-vector-db.md): pgvector on Neon over Dedicated Vector Database
* [**ADR-0007**](./docs/adr/0007-scenario-based-eval-harness.md): Scenario-Based Eval Harness over Ad-Hoc Manual Testing
* [**ADR-0008**](./docs/adr/0008-vercel-railway-deployment-topology.md): Vercel + Railway Deployment Topology
* [**ADR-0009**](./docs/adr/0009-exponential-urgency-decay-and-dag-prioritization.md): Exponential Urgency Decay and DAG Prioritization
* [**ADR-0010**](./docs/adr/0010-dual-boundary-policy-engine-and-human-in-the-loop.md): Dual-Boundary Policy Engine and Human-in-the-Loop Safeguards
* [**ADR-0011**](./docs/adr/0011-three-durable-memory-types-and-read-classified-storage.md): Three Durable Memory Types and Read-Classified Storage
* [**ADR-0012**](./docs/adr/0012-policy-layer-prompt-injection-defense.md): Policy-Layer Structural Enforcement for Prompt-Injection Defense

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js**: `v18.0.0` or higher
* **Redis**: Local or cloud Redis instance (e.g., Upstash / Redis Cloud)
* **PostgreSQL**: Neon Serverless Postgres with `pgvector` enabled
* **Google Cloud Console**: OAuth 2.0 Web Client ID with Gmail and Calendar scopes
* **Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

### 2. Clone & Install
```bash
git clone https://github.com/PiyushY111/Streamline.git
cd Streamline
npm install
```

### 3. Environment Configuration
Generate a cryptographically secure 256-bit encryption key and configure the environment:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy and fill in `.env`:
```bash
cp .env.example .env
```
Ensure required variables are populated:
```env
# Database & Cache
DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/streamline?sslmode=require
REDIS_URL=redis://localhost:6379

# Security & Encryption
JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=your_64_character_hex_encryption_key

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback

# AI Intelligence
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 4. Database Push & Migrations
Push Drizzle ORM schemas into your Neon database:
```bash
npm --prefix server run db:push
```

### 5. Launch Development Environment
Start both the Express backend and Next.js frontend concurrently:
```bash
npm run dev
```

Or start individual services independently:
```bash
# Backend Server (Port 5001)
npm run dev:server

# Frontend Client (Port 3000)
npm run dev:client
```

Open **`http://localhost:3000`** in your browser to access the Streamline dashboard.

---

## 🧪 Automated Eval Harness & Benchmarks

Streamline includes a dedicated scenario-based evaluation suite independent of standard unit tests:

```bash
# Run Vitest unit & integration tests
npm test

# Run the complete scenario-based AI evaluation harness
npm run eval

# Run TypeScript type verification across client and server
npm run type-check
```

### Evaluation Benchmark Matrix
* **Priority Triage Classification** (`evals/priority.eval.ts`): Benchmarks accuracy across edge-case email scenarios against ground-truth priorities (`P1` to `P4`).
* **Agent Tool Selection Accuracy** (`evals/tool-selection.eval.ts`): Tests parameter parsing and valid tool dispatch across multi-step natural language prompts.
* **Memory Retrieval Precision** (`evals/retrieval-precision.eval.ts`): Evaluates cosine similarity ranking and relevance recall over the 3-tier memory store.
* **Prompt Injection Resistance** (`evals/injection-resistance.eval.ts`): Evaluates policy-layer defense against direct overrides, fake delimiters, and indirect jailbreak attempts.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
