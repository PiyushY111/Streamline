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
* **Autonomous Agent Decision Studio**: An interactive multi-turn agent capable of scheduling events, drafting emails, managing tasks, and recalling memories using explicit thought signatures.
* **Dual-Boundary Policy Engine & Human-in-the-Loop Shield**: Automated interception of state-mutating actions (`send_email`, `create_calendar_event`, `create_task`) requiring cryptographic human review before execution.
* **Policy-Layer Prompt Injection Defense**: Structural isolation of untrusted external content via delimiter neutralization, preventing indirect prompt injections from hijacking agent execution.
* **Durable Semantic Memory Vault (pgvector)**: Continuous semantic recall across 3 memory classes (*User Preferences*, *Confirmed Decisions*, *Project Facts*) with hybrid vector and keyword search.
* **OpenTelemetry-Compliant Observability**: Real-time waterfall trace profiler tracking per-step latencies, model vs. tool overhead, and exact token/USD cost attribution via live SSE streams.
* **DAG Task Dependency Engine**: Topological sorting with cycle detection and exponential urgency decay scoring to deterministically select your next best task.
* **AI Cost Guard & Circuit Breaker**: Autonomous per-user daily token budgets and USD spend limits with automatic tripping mechanisms.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph MultiAccount ["Multi-Account Ingestion & Sync"]
        G1["Work Gmail & Calendar"]
        G2["Personal Gmail & Calendar"]
        G3["University / Org Mail"]
    end

    subgraph SecurityCore ["Zero-Trust Security & Storage Layer"]
        AES["AES-256-GCM Token Vault"]
        PolicyEngine["Dual-Boundary Policy Engine"]
        Shield["Pending Action Approval Shield"]
        NeonDB[("Neon Serverless Postgres")]
        PGVector[("pgvector HNSW Memory Store")]
    end

    subgraph AsyncEngine ["Async Background Core"]
        BullMQ["BullMQ 5.x Job Queues"]
        RedisBus["Redis Cache & Event Bus"]
        Workers["Sync, Triage & Digest Workers"]
    end

    subgraph GeminiAI ["AI Intelligence & Agent Layer"]
        AgentStudio["Autonomous Agent Decision Studio"]
        Cascade["Multi-Model Cascade (Gemini 3.5/3.6)"]
        CostGuard["AI Cost Guard & Circuit Breaker"]
        Tools["Tool Registry (Email, Cal, Task, Memory)"]
        OTel["OpenTelemetry Trace Profiler"]
    end

    subgraph UnifiedOS ["Streamline Personal OS Dashboard"]
        Inbox["Unified Multi-Account Inbox"]
        Drafter["Streaming Contextual Drafter"]
        CalendarUI["Integrated Agenda & Direct Scheduling"]
        TaskDAG["Action Item DAG & Urgency Planner"]
        MemVault["Durable Memory Vault & RAG Simulator"]
        SecDash["Security Guardrails & Injection Lab"]
        TraceUI["Live Decision Trace Waterfall"]
    end

    G1 & G2 & G3 --> AES --> BullMQ --> Workers --> NeonDB
    NeonDB <--> PGVector
    NeonDB & PGVector --> AgentStudio & Cascade
    AgentStudio --> Tools --> PolicyEngine
    PolicyEngine -->|Safe / Read-Only| Tools
    PolicyEngine -->|Mutating Action| Shield -->|User Approved| Tools
    AgentStudio --> OTel --> TraceUI
    Cascade --> CostGuard
    Tools & Cascade --> Inbox & Drafter & CalendarUI & TaskDAG & MemVault & SecDash
```

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

### 🤖 3. Autonomous Agent Decision Studio & Human-in-the-Loop
* **Multi-Turn Decision Agent**: Natural language assistant equipped with specialized operational tools:
  * `get_email`, `send_email`, `draft_email`
  * `create_calendar_event`, `find_free_slots`
  * `create_task`, `get_tasks`
  * `save_memory`, `search_memory`
* **Thought Signatures**: Transparent agent reasoning with explicit internal reasoning steps before executing actions.
* **Dual-Boundary Policy Interception**: State-mutating operations are held in a secure `pending_actions` queue, displaying impact previews and requiring one-click user authorization before touching Google APIs.

### 🛡️ 4. Durable Memory Vault & pgvector Semantic RAG
* **3-Tier Durable Memory Architecture** ([ADR-0011](./docs/adr/0011-three-durable-memory-types-and-read-classified-storage.md)):
  * `preference`: Working styles, communication habits, and scheduling preferences.
  * `decision`: Confirmed agreements, policy rules, and explicit directives.
  * `project_fact`: System configurations, architectural constraints, and organizational context.
* **Hybrid Search Engine**: Neon PostgreSQL `pgvector` HNSW cosine similarity search combined with full-text keyword indexing.
* **Interactive RAG Simulator**: Live dashboard to inspect memory embeddings, run similarity queries, and preview agent context injection in real time.

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
| **`/agent`** | Agent Decision Studio | Multi-turn AI assistant, tool execution, pending approval cards, thought inspection. |
| **`/agent/traces/[id]`** | Trace Profiler | OpenTelemetry span waterfall, step latencies, token usage, and USD cost decomposition. |
| **`/memory`** | Memory Vault | Semantic memory records, category filters, interactive pgvector RAG similarity simulator. |
| **`/security`** | Security Guardrails | Threat posture monitor, untrusted content shield status, live injection penetration testing. |
| **`/calendar`** | Calendar & Agenda | Synchronized multi-calendar view, free-slot finder, direct event scheduling modal. |
| **`/tasks`** | Task Manager & DAG | Action item radar, dependency blocker tracking, exponential urgency score ranking. |
| **`/digest`** | Executive Digest | Daily synthesized morning briefing, newsletter summaries, actionable highlights. |
| **`/settings`** | System Settings | Google account connections, token status, sync intervals, and AI cost guard limits. |

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
