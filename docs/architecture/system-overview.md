# System Architecture & Overview

Streamline is architected as a modular, event-driven personal productivity platform designed for background data synchronization, decoupled processing, and autonomous AI-assisted workflow orchestration.

---

## 1. High-Level System Topology

```mermaid
graph TD
    subgraph Client Layer ["Client Layer (Next.js 15 App Router)"]
        UI["React 19 UI & Client State"]
        SSE_Client["SSE Stream Consumer (AI Drafter)"]
        Theme["Theme & Layout Engine"]
    end

    subgraph Edge_Gateway ["Edge & API Gateway"]
        CORS["CORS & Security Headers"]
        RateLimit["Rate Limiter (IPv4/IPv6)"]
        AuthMiddleware["JWT Session & CSRF Validation"]
    end

    subgraph Backend_Services ["Backend API & Micro-Services (Express + TS)"]
        AuthCtrl["Auth & OAuth Controller"]
        EmailCtrl["Emails Controller"]
        AiCtrl["Gemini AI Controller"]
        SyncCtrl["Sync Dispatcher"]
        CacheService["Redis L1 Cache Layer"]
    end

    subgraph Async_Engine ["Async Background Engine (BullMQ + Redis)"]
        RedisBus["Redis Message Bus"]
        SyncWorker["Account Sync Worker"]
        AiWorker["AI Triage Worker"]
        DigestWorker["Daily Digest Worker"]
        CronScheduler["Background Cron Scheduler"]
    end

    subgraph External_Cloud ["Cloud & External Services"]
        NeonDB[("Neon Serverless Postgres")]
        GoogleAPI["Google Workspace APIs (Gmail, Cal)"]
        GeminiAPI["Google Gen AI (Gemini 3.5/3.6 Flash)"]
    end

    UI -->|HTTP / JSON| CORS
    SSE_Client -->|EventStream| CORS
    CORS --> RateLimit --> AuthMiddleware
    AuthMiddleware --> AuthCtrl & EmailCtrl & AiCtrl & SyncCtrl

    EmailCtrl --> CacheService
    CacheService <-->|Get / Set Cache| RedisBus
    EmailCtrl --> NeonDB

    SyncCtrl -->|Enqueue Jobs| RedisBus
    CronScheduler -->|Periodic Trigger| RedisBus
    RedisBus --> SyncWorker & AiWorker & DigestWorker

    SyncWorker --> GoogleAPI
    SyncWorker --> NeonDB
    SyncWorker -->|Enqueue New Emails| AiWorker

    AiWorker --> GeminiAPI
    AiWorker --> NeonDB

    DigestWorker --> GeminiAPI
    DigestWorker --> NeonDB
```

---

## 2. Monorepo Organization

```text
Streamline/
├── client/                     # Next.js 15 Frontend Application
│   ├── src/
│   │   ├── app/                # App Router (Dashboard: inbox, agent, memory, security, calendar, tasks, digest)
│   │   ├── components/         # Reusable UI components (Inbox, Agent Studio, Drafter, Task Radar, Memory)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/api/            # Typed API client, fetch wrappers, and DTO definitions
│   │   └── providers/          # React Context providers (AuthContext, ThemeContext)
│   ├── public/                 # Static assets and icons
│   └── package.json
│
├── server/                     # Node.js + Express + BullMQ Backend
│   ├── evals/                  # Automated scenario-based AI evaluation harness
│   │   ├── scenarios/          # Ground-truth JSON test cases (priority, tool, memory, injection)
│   │   ├── runner.ts           # Asynchronous eval runner
│   │   └── run-all.ts          # Master evaluation execution script
│   ├── scripts/                # Utility scripts (injection demo, pgvector test, seed clean)
│   ├── src/
│   │   ├── config/             # Environment validation with Zod
│   │   ├── controllers/        # REST route controllers (Agent, Auth, Accounts, Emails, Events, Tasks, etc.)
│   │   ├── db/                 # Database connection, migrations, and schema definitions
│   │   │   └── schema/         # Drizzle schemas (users, accounts, emails, agent, memories, tasks, ai)
│   │   ├── middlewares/        # Security headers, auth, rate limiting, validation
│   │   ├── queues/             # BullMQ queue instances and Redis connection factory
│   │   ├── repositories/       # Database access layer (Drizzle ORM queries)
│   │   ├── routes/             # Express API routing tables
│   │   ├── schemas/            # Zod validation schemas for requests
│   │   ├── services/           # Business logic & integrations
│   │   │   ├── ai/             # Agent orchestrator, policy engine, tools, memory, features, core providers
│   │   │   ├── google/         # Gmail, Calendar sync services, and token rotation
│   │   │   ├── planner.service.ts  # DAG dependency and exponential urgency scoring
│   │   │   └── trace.service.ts    # OpenTelemetry trace assembler & live SSE stream
│   │   ├── utils/              # Crypto (AES-256-GCM), Logger (Pino), OAuth helpers, Redactor
│   │   └── workers/            # BullMQ background workers and cron schedulers
│   ├── package.json
│   └── vitest.config.ts
│
├── docs/                       # Comprehensive Architecture, Security, API & Developer Docs
│   └── adr/                    # Architecture Decision Records (ADR-0001 to ADR-0012)
└── .env.example                # Root environment template
```

---

## 3. Core Architectural Principles

### A. Separation of Concerns & Independent Failure Domains
* **Real-time API Traffic**: Kept lightweight and fast. Expensive synchronization operations never run in the HTTP request cycle; they are dispatched to background queues.
* **Background Workers**: Split by concern (`account-sync-queue`, `ai-email-triage-queue`, `daily-digest-cron-queue`). An unexpected rate limit or timeout during email parsing does not block real-time user browsing or AI draft generation.

### B. Outbox & Idempotency Patterns
* All Gmail sync ingestion jobs use deterministic idempotency keys:
  $$\text{idempotencyKey} = \text{sha256}(\text{accountId} + \text{externalMessageId})$$
* Database insertions utilize `ON CONFLICT (account_id, external_message_id) DO NOTHING`, ensuring duplicate Google sync events collapse gracefully without duplicate entries or state corruption.

### C. Layered Caching Architecture
* **L1 Application Cache (Redis)**: Frequently accessed inbox query pages (`emails:userId:folder:page:limit`) are cached with short TTLs (30s).
* **Cache Invalidation**: State-changing actions (mark as read, toggle star, category update, trash, send email) automatically invalidate the matching user cache keys (`emails:userId:*`).

---

## 4. Request Lifecycle & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as Next.js Client
    participant API as Express API
    participant Cache as Redis L1 Cache
    participant DB as Neon PostgreSQL
    participant Worker as BullMQ Worker
    participant Gemini as Gemini 3.5 Flash

    User->>Client: Open Inbox View
    Client->>API: GET /api/emails?folder=inbox
    API->>Cache: Check Cache Key
    alt Cache Hit
        Cache-->>API: Return Cached Email Array
    else Cache Miss
        API->>DB: Query Emails joined with AI Metadata
        DB-->>API: Return Queried Rows
        API->>Cache: Set Cache (TTL 30s)
    end
    API-->>Client: 200 OK (Clean payload without sensitive tokens)
    Client-->>User: Render Inbox with Priority & Topic Badges

    Note over User,Client: User clicks "Draft with Gemini"
    User->>Client: Click AI Reply Button
    Client->>API: POST /api/ai/draft-reply (tone, context)
    API->>Gemini: Stream Prompt via generateContentStream()
    loop SSE Chunks
        Gemini-->>API: Stream Text Chunk
        API-->>Client: data: {"text": "..."}
        Client-->>User: Live Typing Effect in Modal
    end
```
