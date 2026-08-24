# Personal Productivity OS — Advanced Architecture & Security Addendum
 
This extends the base Build Plan. It replaces §2 (Architecture), §5 (Sync Engine), §11 (API Surface), and §12 (Security) with a production-grade version. Everything else in the base plan (schema, features, roadmap) still applies — this document makes the underlying system robust enough to trust with real credentials and real email.
 
---
 
# PART A — COMPLEX ARCHITECTURE
 
## A1. Service Decomposition
 
Instead of one monolithic worker, split by responsibility and failure domain. Each service is independently deployable and independently scalable.
 
```text
┌────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────┐
│   Edge / API Gateway │  (Next.js middleware or dedicated gateway)
│  - TLS termination    │
│  - Rate limiting      │
│  - CORS / CSP          │
│  - Auth verification  │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐        ┌──────────────────────┐
│   Web/API Service     │◄──────►│   Auth Service        │
│  (Next.js API routes) │        │  (sessions, OAuth,    │
│  - reads (cached)      │        │   token refresh)      │
│  - writes → enqueue    │        └──────────────────────┘
└──────────┬─────────────┘
           │ publish
           ▼
┌─────────────────────────────────────────────┐
│               Message Bus (Redis Streams      │
│               or BullMQ queues as MVP;         │
│               swap for Kafka/SQS if scaling)   │
└───────┬───────────┬───────────┬───────────────┘
        │            │            │
        ▼            ▼            ▼
 ┌────────────┐ ┌────────────┐ ┌────────────┐
 │Gmail Worker │ │Cal Worker   │ │Notification │
 │(sync + send)│ │(sync + CRUD)│ │Worker       │
 └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
        │               │               │
        └───────┬───────┴───────┬───────┘
                 ▼               ▼
          ┌─────────────┐ ┌─────────────┐
          │  Postgres    │ │   Redis      │
          │ (primary +   │ │ (cache +     │
          │  read replica)│ │  queue)      │
          └─────────────┘ └─────────────┘
```
 
**Why split Gmail Worker from Calendar Worker instead of one generic "sync worker"?**
- Independent failure domains — Gmail API outage doesn't stall calendar sync
- Independent rate-limit budgets — Gmail and Calendar have separate Google API quotas; mixing them in one process makes throttling logic messy
- Independent scaling — if a user has 5 huge Gmail accounts and 1 calendar, you can scale Gmail workers without wasting resources scaling calendar workers
For a personal project this is more than strictly necessary at day-one scale, but it's the right shape to grow into without a rewrite.
 
## A2. Event-Driven Core (Outbox Pattern)
 
Problem this solves: if you write to Postgres and then try to enqueue a job, and the process crashes between those two steps, you get silent data loss (row exists, no job ever runs).
 
**Solution — Transactional Outbox:**
```text
BEGIN TRANSACTION
  INSERT INTO events (...)
  INSERT INTO outbox (event_type: 'event.created', payload, status: 'pending')
COMMIT
 
-- separate lightweight poller process (or Postgres LISTEN/NOTIFY)
Outbox Relay:
  SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 100
  → publish each to Redis Stream / BullMQ
  → mark status = 'published'
```
This guarantees: if the DB write commits, the downstream job *will* eventually fire, even if the process crashes right after. No dual-write inconsistency.
 
## A3. CQRS-lite (Read/Write Separation)
 
- **Writes** always go through the Web/API service → Postgres primary → outbox → workers
- **Reads** (inbox list, agenda, search) hit a **Postgres read replica** once you have real load, with the Web service caching hot queries (today's agenda, unread counts) in Redis with a short TTL (10-30s) and invalidating on relevant write events
- Keeps the primary DB free for writes/sync jobs, which are the actual bottleneck at scale (Gmail sync writes far more than a user reads)
At V1/personal-project scale, a single Postgres instance is fine — this is documented so the migration path exists without redesigning the schema later (just point read queries at a replica connection string).
 
## A4. Idempotency & Exactly-Once-Effect Processing
 
External sync is inherently at-least-once (Google can redeliver a webhook, a poll can overlap a retry). Design for it:
 
- Every job carries an **idempotency key** (e.g. `gmail-sync:{account_id}:{history_id}`)
- Before processing, worker checks a `processed_jobs` table/Redis SET for that key — if present, skip
- All upserts use `external_id` as the natural key (`ON CONFLICT (account_id, external_message_id) DO UPDATE`), so re-processing the same Gmail message is a no-op, not a duplicate row
- Webhook endpoints verify the payload and immediately enqueue with a deterministic idempotency key derived from the notification, so duplicate Google Pub/Sub deliveries collapse into one job
## A5. Resilience Patterns
 
- **Circuit breaker** per external dependency (Gmail API, Calendar API) — after N consecutive failures for an account, stop hammering it, back off exponentially, surface `sync_states.status = 'error'` immediately instead of retrying into a rate-limit ban
- **Dead-letter queue** — jobs that exhaust retries move to a `*-dlq` queue for manual inspection instead of vanishing or retrying forever
- **Bulkheads** — per-account concurrency caps (e.g. max 3 concurrent sync jobs per account) so one runaway account can't starve the queue for everyone else (matters even with one user, once you have several accounts)
- **Timeouts on every external call** — never let a hung Google API call hold a worker slot indefinitely
## A6. Caching Strategy
 
| Data | Cache? | TTL | Invalidation |
|---|---|---|---|
| Today's unified agenda | Yes (Redis) | 15s | On event write (via outbox event) |
| Unread counts | Yes (Redis) | 10s | On email read/unread write |
| Free-slot results | Yes (Redis, keyed by params) | 30s | Time-based only (cheap to recompute) |
| Search results | No | — | Always live query (Postgres FTS is fast enough) |
| Account list | Yes (in-memory per request via React Query) | — | Client-side only |
 
## A7. Database Scaling Considerations
 
- **Partitioning:** if `emails` grows large (multi-year, multi-account), partition by `account_id` range or by month on `received_at` — Postgres native declarative partitioning, decided once row counts approach ~10M+
- **Connection pooling:** PgBouncer in front of Postgres — both web service (many short-lived connections) and worker service (fewer, longer-lived) benefit from pooled connections instead of exhausting Postgres's native connection limit
- **Full-text search:** Postgres `tsvector` + GIN index is sufficient through V1/V2; migrate to Meilisearch/Typesense only if search latency becomes a real problem, not preemptively
## A8. Observability Stack
 
You cannot operate a multi-account sync system blind. Build this in from Phase 3 (Sync Engine), not bolted on later.
 
- **Structured logging** — every worker job logs `{job_id, account_id, service, duration_ms, status}` as JSON (e.g. via Pino), shipped to a log sink (Railway logs are fine at small scale; Better Stack/Axiom if you want retention + search)
- **Error tracking** — Sentry (or similar) on both web and worker services, with `account_id`/`user_id` as tags so you can filter "all errors for this account"
- **Metrics** — track: sync lag (time since last successful sync per account), queue depth per queue, job failure rate, Google API quota usage. Even a simple `/api/internal/health` endpoint reporting these numbers is enough at personal-project scale; Prometheus + Grafana if you want dashboards
- **Tracing** — optional at this scale, but structure logs with a `request_id`/`job_id` that flows from API call → enqueue → worker processing, so you can follow one action end-to-end in logs without full distributed tracing infra
## A9. Deployment Topology
 
```text
Railway project
 ├── web              (Next.js — public)
 ├── auth              (can start as part of web; split out only if it becomes a bottleneck)
 ├── gmail-worker      (BullMQ consumer)
 ├── calendar-worker   (BullMQ consumer)
 ├── notification-worker
 ├── outbox-relay      (small poller, or Postgres LISTEN/NOTIFY listener)
 ├── postgres-primary
 ├── postgres-replica  (added when read load justifies it — not day one)
 ├── redis
 └── pgbouncer         (added when connection count justifies it — not day one)
```
 
Start with `web` + one combined `worker` (as in the base plan) and only split into `gmail-worker` / `calendar-worker` / `notification-worker` once you feel contention between them. The architecture above is the target shape — build toward it, don't over-provision on day one for a single user.
 
---
 
# PART B — COMPLETE SECURITY
 
Security here is organized as defense-in-depth: network → transport → application → data → operational.
 
## B1. Identity & Authentication
 
**App-level auth (your own login):**
- Passwordless magic-link or OAuth-only login (avoid storing app passwords at all if possible — one less secret class to protect)
- If passwords are supported: Argon2id hashing (not bcrypt/scrypt), enforced minimum entropy, no maximum length caps
- Session tokens: short-lived JWT (15 min) + rotating refresh token stored in an **httpOnly, Secure, SameSite=Strict** cookie — never in localStorage (XSS-exposed)
- Refresh token rotation: each use issues a new refresh token and invalidates the old one; detect reuse of an invalidated token as a signal of theft and revoke the whole session family
- Optional TOTP-based MFA for app login (even for a personal project, worth it since this app touches your email)
**Google OAuth (per connected account):**
- Authorization Code flow **with PKCE** — mandatory even for confidential clients, protects against interception
- `state` parameter: cryptographically random, stored server-side tied to the initiating session, verified on callback (CSRF protection for the OAuth flow itself)
- Minimal, progressive scopes — request Gmail scope only when connecting Gmail, Calendar scope only when connecting Calendar, not both bundled by default
- Immediately after token exchange, tokens are encrypted (§B4) before touching the database — never held in plaintext in application memory longer than the exchange itself
## B2. Authorization
 
- **Row-level scoping enforced at the query layer, not just the API layer** — every Drizzle query for emails/events/tasks includes `WHERE user_id = :currentUser` as a non-optional clause; consider Postgres **Row-Level Security (RLS) policies** as a second, DB-enforced layer so a bug in application code can't leak cross-user data even if someone forgets the `WHERE` clause
- `connected_account_id` provided by the client is always re-verified server-side to belong to the requesting user before any operation — never trust a client-supplied foreign key
- Internal service-to-service calls (e.g. worker → web internal API, if any) use a separate service credential, never a user session
## B3. Network & Transport
 
- TLS 1.2+ enforced everywhere (Railway/Render provide this by default at the edge — verify it's not falling back)
- HSTS header (`Strict-Transport-Security`) with `includeSubDomains` and a long max-age
- CORS: allow-list only your own frontend origin for the API; no wildcard `*`
- CSP header restricting script sources to self + explicitly trusted CDNs, blocking inline scripts where possible (mitigates XSS blast radius)
- `X-Frame-Options: DENY` / `frame-ancestors 'none'` — prevent clickjacking on an app that can send email on your behalf
- Rate limiting at the gateway layer: per-IP and per-user limits on auth endpoints (prevent credential stuffing) and on send-email/create-event endpoints (prevent abuse if a session is compromised)
## B4. Secrets & Encryption
 
- **OAuth tokens encrypted at rest** using envelope encryption: a per-record Data Encryption Key (DEK) encrypts the token, and a Key Encryption Key (KEK) held in a secrets manager (Railway secrets, or a real KMS like AWS KMS/GCP KMS if you outgrow Railway) encrypts the DEK. This means rotating the master key doesn't require re-encrypting every row individually if implemented with per-record DEKs wrapped by the KEK.
- Minimum viable version if full envelope encryption is overkill for personal-project stage: AES-256-GCM with a single application-level key stored in the platform's secret manager (Railway env var, never in code/git), rotated periodically
- Database credentials, Redis credentials, Google client secret, encryption keys — all injected via platform secret manager, never committed, never logged
- `.env.example` in the repo with placeholder values only; real `.env` git-ignored
- Secret scanning enabled in CI (e.g. GitHub secret scanning / gitleaks) to catch accidental commits before merge
## B5. Application-Layer Hardening
 
- **Input validation on every boundary** — Zod schemas shared between client and server for every form (compose, create event, create task) so the server never trusts client-side validation alone
- **Output encoding** — email body HTML rendered in an isolated/sandboxed iframe with a strict CSP, since you're rendering arbitrary third-party HTML (incoming emails) — this is a real XSS vector if unhandled, treat every email body as untrusted content
- CSRF protection on any state-changing endpoint reachable via cookie-based auth (SameSite=Strict cookies handle most of this, but pair with a CSRF token on top for defense-in-depth on the send-email/delete endpoints specifically)
- SQL injection: non-issue with Drizzle's parameterized queries, but confirm no raw string interpolation ever reaches a query, including in the full-text search feature
- Dependency scanning in CI (`npm audit` / Dependabot / Snyk) with a policy to patch high/critical within a defined window
## B6. Webhook Security (Phase 3b — Push Sync)
 
- Google Pub/Sub push endpoints must verify the JWT included in the push request (Google signs it) against Google's public keys — reject anything unsigned or expired
- Webhook endpoint is otherwise unauthenticated by design (Google calls it), so it must do **nothing but validate + enqueue** — no direct DB writes, no trust of payload contents beyond "something changed, go re-sync this account" (never trust the payload's claimed content, always re-fetch from the authoritative Google API)
- Rate-limit the webhook endpoint itself to prevent it being used as a DoS vector against your queue
## B7. Data Privacy & Retention
 
- **Data minimization** — don't store full email bodies longer than needed if you're not going to build search/offline-read on them beyond V1 scope; if you do store them (current plan does), document that clearly for yourself since it's your own data
- **Right to disconnect/delete** — disconnecting an account gives an explicit choice: purge all synced data for that account, or retain read-only. Implement actual hard-delete (not just a status flag) if the user chooses purge, including cascading deletes on emails/events/attachments/tasks-links
- **Backups** — automated encrypted Postgres backups (Railway/Render provide daily snapshots; verify retention window meets your needs, e.g. 7-30 days)
- **Audit log immutability** — `audit_logs` table should be insert-only at the application layer (no update/delete code path), so it remains a trustworthy record of "email sent / account connected / event deleted" even if something else goes wrong
## B8. Incident Readiness
 
- **Token revocation runbook** — if a database leak is ever suspected, you need a documented one-step way to revoke all stored Google refresh tokens (calling Google's revoke endpoint per account) and force all users to reconnect
- **Kill switch** — an environment flag that disables all outbound send-email/create-event actions instantly (feature-flag style) without a full redeploy, useful if abuse or a bug is detected in production
- **Health checks** — `/health` endpoints on both web and worker services so the hosting platform can restart a hung process automatically
## B9. Security Checklist Summary
 
```text
Auth
  [ ] PKCE on Google OAuth
  [ ] state param CSRF protection on OAuth
  [ ] Progressive/minimal scopes
  [ ] Short-lived JWT + rotating refresh token, httpOnly cookies
  [ ] Optional MFA on app login
 
Data
  [ ] Tokens encrypted at rest (envelope or AES-256-GCM)
  [ ] Row-level scoping in every query + DB-level RLS as backup
  [ ] Encrypted backups with defined retention
  [ ] Hard-delete path for account disconnect + purge
 
Transport
  [ ] TLS enforced + HSTS
  [ ] Strict CORS allow-list
  [ ] CSP + X-Frame-Options
 
App
  [ ] Zod validation client + server on every input
  [ ] Sandboxed rendering of email HTML (untrusted content)
  [ ] CSRF token on state-changing routes
  [ ] Dependency + secret scanning in CI
 
Ops
  [ ] Structured logging + error tracking (Sentry)
  [ ] Sync lag / queue depth monitoring
  [ ] Token revocation runbook
  [ ] Kill switch for outbound actions
  [ ] Immutable audit log
```
 
---
 
## Where This Changes the Roadmap
 
Fold this in as **Phase 1.5 — Security & Observability Foundation** (2-3 days), inserted right after Phase 1 (Foundation) and before Phase 2 (Google Account Connection) in the base build plan — because token encryption, RLS, and logging need to exist *before* the first real OAuth token ever touches your database, not retrofitted afterward.
 
The service-split architecture (Gmail Worker / Calendar Worker / Notification Worker as separate deployables) is a **target shape, not a Phase-1 requirement** — build the single combined worker from the base plan first, and split it out in a later phase once you feel actual contention (e.g. Gmail sync jobs delaying calendar sync jobs). Splitting prematurely just adds deployment overhead for a single-user app with no measurable benefit yet.
 