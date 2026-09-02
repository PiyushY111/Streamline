# ADR-0005: Server-Sent Events (SSE) over WebSockets for AI Draft Streaming

* **Status**: Accepted
* **Deciders**: Frontend & AI Team
* **Date**: 2026-08-28

---

## Context and Problem Statement

When users trigger the "Draft with Gemini" modal, the response must stream progressively to give immediate feedback. We evaluated communication protocols between the Next.js frontend and Express backend for real-time LLM token streaming.

---

## Alternatives Considered

1. **Standard REST Polling / Blocking Response**:
   * *Pros*: Simplest implementation.
   * *Cons*: User waits seconds until the entire draft is finished; feels sluggish and provides no visual progress feedback.
2. **WebSockets (`ws` / `socket.io`)**:
   * *Pros*: Full-duplex bidirectional communication, low latency.
   * *Cons*: Requires stateful connection management on the backend; complex load balancing across reverse proxies / API gateways; overkill for a simple one-way stream from server to client.
3. **Server-Sent Events (SSE via `text/event-stream`) (Chosen)**:
   * *Pros*:
     * Built entirely on top of standard HTTP/HTTPS.
     * Native browser support via standard `fetch` with `ReadableStream` (or `EventSource`).
     * Stateless from an infrastructure perspective; works transparently through API gateways, CDN proxies, and Next.js route handlers without custom socket upgrade handling.
     * Natural one-way streaming model: client sends a `POST` request with prompt parameters, server opens the stream and pushes `data: { "text": "..." }\n\n` chunks as Gemini generates tokens.

---

## Decision Outcome

**Chosen Option**: **Server-Sent Events (SSE) over standard HTTP POST**.

### Implementation Highlights
* Response headers set: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
* Stream automatically closes with `res.end()` upon completion or error.
