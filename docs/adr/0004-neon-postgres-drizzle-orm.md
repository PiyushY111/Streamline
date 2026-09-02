# ADR-0004: Neon Serverless PostgreSQL with Drizzle ORM

* **Status**: Accepted
* **Deciders**: Full-Stack Architecture Team
* **Date**: 2026-08-20

---

## Context and Problem Statement

Streamline requires a relational database to manage users, connected mail accounts, thousands of emails, thread trees, AI metadata, calendar events, and audit logs. We needed an ORM and database engine that provides serverless autoscaling, instant branching for staging, minimal memory footprint, and full TypeScript end-to-end type safety.

---

## Alternatives Considered

1. **Prisma ORM with Self-Hosted PostgreSQL**:
   * *Pros*: Popular, easy migrations, intuitive client.
   * *Cons*: Heavy Rust engine binary, high cold-start latency in serverless environments, complex connection management without external connection poolers (PgBouncer).
2. **MongoDB / Document Store**:
   * *Pros*: Schema flexibility for raw JSON email payloads.
   * *Cons*: Weak relational consistency; complex joins across accounts, threads, AI metadata, and tasks; no native ACID transactions across foreign key cascades.
3. **Neon Serverless PostgreSQL + Drizzle ORM (Chosen)**:
   * *Pros*:
     * **Neon**: True serverless autoscaling, scale-to-zero during idle periods, built-in connection pooling (`@neondatabase/serverless`), and instant database branching for preview environments.
     * **Drizzle ORM**: Zero-overhead TypeScript-first query builder with zero binary dependencies, direct SQL transparency, sub-millisecond execution, and type inference without code generation bottlenecks.

---

## Decision Outcome

**Chosen Option**: **Neon Serverless PostgreSQL via `@neondatabase/serverless` and Drizzle ORM**.

### Positive Consequences
* **Single Source of Truth**: Schema defined in pure TypeScript (`server/src/db/schema/`).
* **Zero Runtime Overhead**: Drizzle compiles directly to parameterized SQL strings without intermediate engine overhead.
* **Serverless Resilience**: HTTP / WebSocket pooled connection adapter ensures background workers and API instances never exhaust PostgreSQL connection limits.
