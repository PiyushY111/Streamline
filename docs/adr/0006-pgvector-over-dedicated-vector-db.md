# ADR-0006: pgvector on Neon over a Dedicated Vector Database

* **Status**: Accepted
* **Deciders**: Full-Stack Architecture Team
* **Date**: 2026-09-09

---

## Context and Problem Statement

The agentic memory system (Stage 3) requires storing high-dimensional vector embeddings for user preferences, past decisions, conversation facts, and task context, and retrieving them via semantic similarity search. We need to decide where these vectors live and how they are indexed.

---

## Alternatives Considered

1. **Dedicated Vector Database (Pinecone / Qdrant / Weaviate)**:
   * *Pros*: Purpose-built Approximate Nearest Neighbor (ANN) index scaling, managed infrastructure, rich metadata filtering.
   * *Cons*: Adds a new external infrastructure dependency, new credentials surface, extra network hops and failure modes. Data is duplicated and must be synchronized across two independent databases.
2. **pgvector on the existing Neon PostgreSQL Instance (Chosen)**:
   * *Pros*: Zero new infrastructure — reuses the same database, connection pooling, and backup mechanisms already established (ADR-0004). Memory rows can be joined relationally with `users`, `tasks`, and `emails` in a single SQL query. For personal-scale productivity (thousands to tens of thousands of memory vectors per user), pgvector's indexing (HNSW/IVFFlat) and distance operators (`<->`, `<=>`) provide sub-millisecond query latency without synchronization drift.
   * *Cons*: Not intended for multi-tenant datasets exceeding millions of vectors per user with ultra-high QPS requirements.

---

## Decision Outcome

**Chosen Option**: **`pgvector` extension enabled on the existing Neon PostgreSQL database with native Drizzle ORM `vector` typing.**

### Positive Consequences
* **Unified Single Source of Truth**: Eliminates split-brain synchronization issues between relational entities (`tasks`, `emails`, `users`) and semantic memory embeddings.
* **Zero Extra Operational Cost**: Leverages Neon's built-in pgvector extension support without provisioning third-party vector clusters.
* **Provider-Agnostic Storage**: Stores vector representations from any AI provider (Gemini, OpenAI, Anthropic, or local open-source models).
* **Relational Power**: Allows executing combined SQL queries with semantic similarity order and relational filters in a single round-trip.

### Negative Consequences / Re-evaluation Trigger
* If per-user vector embedding volume exceeds 100,000 items or index build times begin impacting database connection pooling, re-evaluate dedicated vector engines.

---

## Addendum (2026-09-21): RAG Ablation Results — Honest Note

This ADR is about *where vectors live* (pgvector on Neon vs. a separate vector DB), which the
ablation below doesn't touch — that decision stands on the infra-consolidation argument above,
independent of retrieval quality. But since the ablation was run as part of hardening this
system, the result is recorded here because it's directly relevant to anyone re-evaluating this
choice: see [ADR-0011](./0011-three-durable-memory-types-and-read-classified-storage.md)'s
addendum for the full retrieval-quality ablation (vector-only vs. keyword-only vs. hybrid RRF)
and the honest conclusion that hybrid did not clearly beat vector-only on the current eval set.
