# Operational Alerting & Incident Response Runbook

## 1. Overview
This document defines operational metrics, alerting rules, severity tiers, and runbooks for Streamline production infrastructure.

---

## 2. Alert Severity Tiers

| Severity | Response SLA | Notification Channels | Example Incidents |
|---|---|---|---|
| **P1 - Critical** | < 15 Minutes | PagerDuty, Phone Escalation, Slack `#streamline-incidents` | DLQ Job Spike, Neon DB Outage, Mass OAuth Refresh Drop |
| **P2 - Warning** | < 1 Hour | Slack `#streamline-alerts`, Email Digest | AI Circuit Breaker Trips Elevated, Latency Degradation |
| **P3 - Info** | Next Business Day | Slack `#streamline-ops` | Non-blocking background job retries, schema migration logs |

---

## 3. Incident Runbooks

### 3.1 Dead Letter Queue Spike (`DeadLetterQueueSpike`)
- **Metric**: `streamline_dlq_size > 0`
- **Severity**: P1 - Critical
- **Diagnosis**:
  1. Inspect failed jobs in Redis DLQ using redis-cli:
     ```bash
     redis-cli LRANGE dlq:account-sync-queue 0 -1
     redis-cli LRANGE dlq:ai-email-triage-queue 0 -1
     ```
  2. Filter logs for the specific `jobId` and correlated `reqId`:
     ```bash
     grep "❌ Account Sync Worker job failed" /var/log/streamline/server.log
     ```
- **Remediation**:
  - If failure is due to upstream Google rate limits, verify exponential backoff jitter in `resilience.ts`.
  - To replay quarantined jobs after resolving root cause:
    ```bash
    npm --prefix server run dlq:replay -- --queue=account-sync-queue
    ```

---

### 3.2 AI Circuit Breaker Trips (`AiCircuitBreakerTripped`)
- **Metric**: `streamline_circuit_breaker_trips_total >= 5` in 1 hour
- **Severity**: P2 - Warning
- **Diagnosis**:
  1. Identify affected user accounts:
     ```sql
     SELECT user_id, SUM(total_tokens) AS tokens, SUM(estimated_cost_usd) AS cost
     FROM ai_token_usage
     WHERE created_at >= NOW() - INTERVAL '1 hour'
     GROUP BY user_id
     ORDER BY cost DESC
     LIMIT 10;
     ```
  2. Check whether a client is hammering the agent in a loop.
- **Remediation**:
  - If a user has a legitimate high-volume workload, update budget limits in `ai_budget_limits` or user AI preferences.
  - If a client script is rogue, revoke their JWT session token.

---

### 3.3 Google OAuth Refresh Failures (`OAuthRefreshFailureRateHigh`)
- **Metric**: `streamline_oauth_refresh_errors_total > 5%` over 5 minutes
- **Severity**: P1 - Critical
- **Diagnosis**:
  1. Check log messages for `invalid_grant` vs network timeout:
     - `invalid_grant`: User revoked permissions or password was changed. Account status is automatically updated to `error`.
     - `ETIMEDOUT` / `ECONNRESET`: Network partition to Google OAuth2 token endpoint `oauth2.googleapis.com`.
- **Remediation**:
  - For `invalid_grant`, notify user via UI notification to re-authenticate with Google OAuth.
  - For connectivity issues, verify egress firewalls and DNS resolution for `oauth2.googleapis.com`.

---

### 3.4 Agent Tool Loop Detected (`AgentToolLoopDetected`)
- **Metric**: `streamline_policy_decisions_total{decision="loop_rejected"} >= 1`
- **Severity**: P2 - Warning
- **Diagnosis**:
  1. ReAct orchestrator loop guard detected repeated tool executions with identical argument SHA-256 fingerprints.
  2. Inspect trace span waterfall:
     ```bash
     curl -s http://localhost:5001/api/agent/sessions/{sessionId}/trace -H "Authorization: Bearer $TOKEN"
     ```
- **Remediation**:
  - Review tool instruction prompt for ambiguous instructions causing cyclic tool calls.

---

## 4. Health Check Probing Architecture

Streamline exposes 3 health probing levels:

1. `GET /api/health/liveness`: Fast process-level check (returns `200 OK` without hitting external network).
2. `GET /api/health/readiness`: Verifies PostgreSQL and Redis read/write capability (returns `200 OK` or `503 Service Unavailable`).
3. `GET /api/health`: Comprehensive system diagnostics with latency breakdown across PostgreSQL, Redis, and Gemini AI.

Prometheus Scrape Endpoint:
```
GET /metrics
GET /api/metrics
```
Exposes standard Prometheus metric text format for Grafana / Prometheus agent ingestion.
