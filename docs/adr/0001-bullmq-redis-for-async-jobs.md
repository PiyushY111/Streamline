# ADR-0001: Use BullMQ & Redis for Background Job Processing

* **Status**: Accepted
* **Deciders**: Architecture Team
* **Date**: 2026-08-15

---

## Context and Problem Statement

Streamline needs to ingest large batches of emails and calendar events from external Google APIs across multiple accounts without stalling real-time HTTP API requests or exhausting server memory. We needed an asynchronous queueing system capable of rate-limiting, exponential retries, concurrency controls, and scheduled cron jobs.

---

## Alternatives Considered

1. **In-Memory Queue / Node.js `EventEmitter` / `setInterval`**:
   * *Pros*: Zero external infrastructure, simple to set up.
   * *Cons*: Process crashes destroy all pending jobs; unable to scale across multiple worker processes or restart cleanly during deployments.
2. **PostgreSQL-backed Queue (e.g., `pg-boss` or custom `SKIP LOCKED` table)**:
   * *Pros*: Reuses existing PostgreSQL instance, guarantees transactional consistency.
   * *Cons*: High write and polling churn causes database bloat and connection exhaustion on serverless Postgres (Neon); high latency compared to in-memory Redis.
3. **Heavy Enterprise Message Brokers (RabbitMQ / Apache Kafka / AWS SQS)**:
   * *Pros*: Infinite scale, persistent streaming.
   * *Cons*: Excessive operational overhead, vendor lock-in (SQS), complex local development setup for a personal productivity OS.
4. **BullMQ + Redis (Chosen)**:
   * *Pros*: Blazing-fast in-memory queueing, native support for job deduplication, rate limiting, cron schedules, stalled-job recovery, and built-in concurrency controls. Works with standard Redis or Upstash serverless Redis.

---

## Decision Outcome

**Chosen Option**: **BullMQ backed by Redis (`ioredis`)**.

### Positive Consequences
* **Sub-millisecond job enqueuing**: HTTP requests enqueue sync and AI triage jobs without waiting on external I/O.
* **Deterministic Idempotency**: Job IDs (`account-sync-{accountId}`) prevent duplicate overlapping sync jobs.
* **Independent Worker Concurrency**: Concurrency is tuned per domain (e.g., Sync: 2, Triage: 3, Digest: 1) preventing rate-limit starvation.

### Negative Consequences / Tradeoffs
* Requires a running Redis instance or serverless Redis connection (e.g., Upstash) in addition to PostgreSQL.
