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

---

## Addendum (2026-09-21): The "Scheduled Cron Jobs" Benefit Wasn't Actually Used Until Now

This ADR cites BullMQ's native repeatable/cron job support as a reason to choose it over plain
`setInterval` (row 1 above: "unable to scale across multiple worker processes or restart cleanly
during deployments"). Despite that, `src/workers/scheduler.ts`'s 2-minute account-sync trigger
was implemented with a bare in-process `setInterval` from the start — reintroducing exactly the
problem this ADR argued against: the schedule didn't survive a process restart, and since both
`src/index.ts` (API server) and `src/worker.ts` (standalone worker) call it, and either can be
horizontally scaled, every replica ran its own independent timer racing to enqueue the same
per-account jobs (softened, but not eliminated, by per-account job-ID deduplication).

Fixed by migrating to a real BullMQ Job Scheduler (`Queue.upsertJobScheduler`), which is the
feature this ADR meant to invoke in the first place: the schedule is now a single definition
stored in Redis, calling `initAccountSyncScheduler()` from every replica's startup converges to
exactly one shared schedule (BullMQ's own idempotent upsert semantics — not reimplemented here),
and it survives process restarts because the definition lives in Redis, not in-process memory.
See `scheduler.test.ts` for coverage of the fan-out/dedup logic and the honest note on why a live
Redis integration proof couldn't be completed in the same session this was written (the shared
dev Redis was over its own daily quota by then) — `scripts/verify-scheduler-no-double-enqueue.ts`
is provided to complete that proof once a Redis instance with quota headroom is available.

`daily-digest.worker.ts` and `retention-purge.worker.ts` still use the same `setInterval`
pattern and were not touched in this pass (out of scope for what was asked) — they carry the
same restart/multi-replica caveat as a known, undocumented-until-now limitation.
