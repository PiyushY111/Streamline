# ADR-0008: Vercel (Frontend) + Railway (Backend, Workers, Redis) Deployment Topology

* **Status**: Accepted
* **Deciders**: Full-Stack Architecture Team
* **Date**: 2026-09-09

---

## Context and Problem Statement

Streamline comprises a Next.js 15 App Router web client, an Express 5 REST/SSE API server, persistent BullMQ background workers for email sync and AI digest generation, a Redis instance, and a Neon PostgreSQL database. We needed a deployment topology that preserves long-running worker processes and SSE streaming without architectural rework when ready to host in production.

---

## Alternatives Considered

1. **All-in-One Serverless on Vercel (Client + Server as Vercel Functions)**:
   * *Pros*: Single deployment platform.
   * *Cons*: Serverless functions cannot run long-lived persistent BullMQ workers, scheduled cron listeners, or long SSE connections reliably without external queue dispatchers.
2. **Fly.io / AWS ECS for all services**:
   * *Pros*: High infrastructural control and container orchestration.
   * *Cons*: High DevOps maintenance overhead, complex Docker orchestration for a single-developer setup.
3. **Vercel (Client) + Railway (Server, Workers, Redis) (Chosen)**:
   * *Pros*:
     - **Vercel**: Optimal native platform for Next.js (fast Edge/SSR caching, automatic preview deployments, zero-config asset bundling).
     - **Railway**: Native support for persistent Node.js services (`server/src/index.ts` API + `server/src/worker.ts` BullMQ worker), managed Redis add-on, private networking, environment variable management, and automatic Git-based deploys.
     - Zero architectural redesign required from local development to production.
   * *Cons*: Requires managing two hosting dashboards (Vercel and Railway) and configuring CORS/OAuth redirect URIs across domains.

---

## Decision Outcome

**Chosen Option**: **Deploy the Next.js frontend to Vercel, and deploy the Express API, BullMQ Worker process, and Redis instance to Railway.**

### Positive Consequences
* Long-running BullMQ jobs and periodic sync schedules run uninterrupted on dedicated worker processes.
* Fast global frontend delivery via Vercel Edge CDN.
* Isolated compute boundaries: heavy AI background processing cannot starve real-time HTTP requests.

### Implementation Readiness
* The backend codebase is decoupled into dual entrypoints (`src/index.ts` for HTTP/SSE API and `src/worker.ts` for BullMQ workers) to enable seamless deployment when the build is complete.
