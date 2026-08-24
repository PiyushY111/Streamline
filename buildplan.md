# Personal Productivity OS — Technical Build Plan (V1)
 
This build plan implements the features defined in the Feature Document, in priority order (Tier 1 → 2 → 3).
 
---
 
## 1. Tech Stack
 
### Frontend
- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** — server state (emails, events, tasks)
- **Zustand** — light client UI state (selected account filter, panel open/close)
- **React Hook Form + Zod** — forms + validation (compose, create event, create task)
### Backend
- **Node.js + TypeScript**
- **Next.js API routes** for request/response endpoints (auth, CRUD, search)
- **Separate worker service** (plain Node process, not serverless) for sync jobs — see §5
- **PostgreSQL** — system of record
- **Drizzle ORM**
- **Redis** — job queue (BullMQ) + cache for free-slot calculations
- **BullMQ** — background job queue
### Infra (from hosting discussion)
- **Railway** (or Render) for: web service, worker service, Postgres, Redis — one platform, one repo, two deploy targets
- **Google Cloud project** for OAuth credentials + Pub/Sub (for push sync, added in Phase 3b)
---
 
## 2. High-Level Architecture
 
```text
                         ┌───────────────┐
                         │    Browser    │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │  Next.js Web  │  (Railway: web service)
                         │  App + API    │
                         └───────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              PostgreSQL       Redis      Google APIs
             (Railway addon) (queue+cache) (Gmail/Calendar)
                    ▲            ▲
                    │            │
                    └─────┬──────┘
                          │
                  ┌───────▼────────┐
                  │  Worker Service │  (Railway: worker service)
                  │  (BullMQ jobs)  │
                  └────────────────┘
```
 
**Two deploy targets, one codebase:**
- `apps/web` → Next.js, talks to Postgres for reads, enqueues jobs to Redis for writes that need Google API calls (send email, create event) OR calls Google directly for synchronous user-initiated actions
- `apps/worker` → long-running Node process, consumes the BullMQ queues, does all sync (polling + eventually webhook-triggered), talks to Google APIs + writes to Postgres
---
 
## 3. Unified Data Model
 
Core principle: the app never depends directly on Gmail/Calendar's raw shapes. Everything is normalized into your own schema, tagged with its source account.
 
```text
User
 └── ConnectedAccount (Google, tagged with a color)
       ├── EmailThread → Email → Attachment
       ├── Calendar → Event → EventAttendee
       └── SyncState (per service: gmail / calendar)
 
Task (app-native)
 ├── links to Email (optional)
 └── links to Event (optional)
```
 
Every synced object carries:
```text
id                UUID (internal)
account_id        FK → connected_accounts
external_id       Gmail/Calendar's own ID
created_at / updated_at
```
 
---
 
## 4. Database Schema
 
### users
```text
id, email, name, avatar, created_at, updated_at
```
 
### connected_accounts
```text
id
user_id
provider              -- 'google'
provider_account_id
email
label                 -- user-given name: "Personal", "Agency"
color                 -- hex, used for tagging everywhere in UI
avatar
access_token          -- encrypted
refresh_token         -- encrypted
token_expires_at
scopes
status                -- active | error | disconnected
created_at / updated_at
```
 
### sync_states  *(one row per account per service)*
```text
id
account_id
service               -- 'gmail' | 'calendar'
sync_cursor           -- Gmail historyId / Calendar syncToken
last_synced_at
last_error
status                -- idle | syncing | error
```
 
### email_threads
```text
id, account_id, external_thread_id, subject, snippet,
last_message_at, is_starred, is_important, created_at, updated_at
```
 
### emails
```text
id, thread_id, account_id, external_message_id,
sender, recipients, cc, bcc, subject, body_text, body_html,
received_at, sent_at, is_read, is_starred, is_important,
created_at, updated_at
```
 
### labels / email_labels
```text
labels: id, account_id, external_label_id, name, type
email_labels: email_id, label_id
```
 
### attachments
```text
id, email_id, external_attachment_id, filename, mime_type, size,
storage_reference (nullable — fetched on demand in V1), created_at
```
 
### calendars
```text
id, account_id, external_calendar_id, name, description,
timezone, color, is_primary, is_visible
```
 
### events
```text
id, calendar_id, account_id, external_event_id,
title, description, location, start_time, end_time, timezone,
status, recurrence_rule, html_link,
source_email_id      -- nullable FK, set when "Create Event from Email" is used
created_at, updated_at
```
 
### event_attendees
```text
id, event_id, email, name, response_status, organizer
```
 
### tasks
```text
id, user_id, title, description, status, priority,
due_at, completed_at,
source_email_id      -- nullable FK
source_event_id      -- nullable FK
created_at, updated_at
```
 
### notifications
```text
id, user_id, type, payload (jsonb), is_read, created_at
```
 
**Indexes to add day one:** `emails(account_id, received_at)`, `events(account_id, start_time, end_time)`, `emails(is_read)`, `tasks(user_id, status, due_at)`. Full-text index on `emails.subject + body_text` and `events.title + description` for Global Search (Postgres `tsvector`).
 
---
 
## 5. Sync Engine (the core technical challenge)
 
### 5a. Initial sync (on account connect)
```text
OAuth callback
   ↓
Create connected_account row (status: syncing)
   ↓
Enqueue: gmail-initial-sync, calendar-initial-sync
   ↓
Return user to dashboard immediately (never block on OAuth callback)
   ↓
Worker: fetch metadata → threads/messages → labels
Worker: fetch calendars → events
   ↓
Write to Postgres in batches
   ↓
Store sync_cursor (Gmail historyId / Calendar syncToken)
   ↓
Set status: active
```
 
### 5b. Incremental sync (polling — V1 default, per hosting discussion)
```text
Scheduled job (every 5 min per account, via BullMQ repeatable jobs)
   ↓
Gmail: users.history.list(startHistoryId = stored cursor)
Calendar: events.list(syncToken = stored cursor)
   ↓
Apply diffs (new/updated/deleted) to Postgres
   ↓
Update sync_cursor
   ↓
If any new events created/moved → recompute double-booking flags (§6)
```
 
### 5c. Push-based sync (Phase 3b, after polling works)
```text
Gmail: users.watch() → Google Cloud Pub/Sub topic → webhook endpoint on web app → enqueue immediate sync job
Calendar: events.watch() → push channel → webhook endpoint → enqueue immediate sync job
```
Push notifications only tell you "something changed" — you still run the same incremental sync job, just triggered instantly instead of on a timer. Keep the 5-min poll as a fallback/reconciliation pass even after push is added.
 
### 5d. Job queues
```text
queues/
  gmail-initial-sync
  gmail-incremental-sync
  calendar-initial-sync
  calendar-incremental-sync
  send-email            -- triggered by user compose/reply/quick-reply
  create-event           -- triggered by user create/Create-from-Email
  digest-generate        -- daily, per user
  cleanup                -- token refresh, stale data pruning
```
 
### 5e. Failure isolation
- Each account's sync job is independent — one account's failure updates that account's `sync_states.status = 'error'` and stops there, never throws across accounts
- Retry with exponential backoff (BullMQ built-in), max 5 attempts, then surface as a Notification ("Sync failed for Agency Gmail")
- Token refresh handled transparently in the worker before every job; if refresh fails (revoked), mark account `status: 'error'` and notify user to reconnect
---
 
## 6. Double-Booking Detection (Unified Daily Agenda)
 
Runs as a lightweight computation, not stored redundantly per event (avoid drift):
 
```text
On read (fetching agenda for a date range):
  1. Query all events across all visible calendars in range
  2. Sort by start_time
  3. Sweep-line overlap check: if event[i].end_time > event[i+1].start_time → flag both as conflicting
  4. Return events with a computed `conflicts_with: [event_id, ...]` field
```
 
This is cheap enough to compute on every request for a day/week window (dozens of events, not thousands), so no need to persist conflict state — it's always fresh. Cache the computed result per date-range in Redis for a few seconds if the dashboard is hit repeatedly (optional, not needed for V1 scale).
 
---
 
## 7. Free-Slot Finder (§8a of feature doc)
 
```text
Input: date range, duration_minutes, working_hours (optional), account_ids (default: all)
   ↓
Query all events in range across selected accounts (from Postgres — never hits Google live)
   ↓
Merge all busy intervals into one sorted timeline
   ↓
Walk the timeline, collect gaps >= duration_minutes
   ↓
Optionally clip gaps to working_hours window
   ↓
Return list of candidate slots
```
 
Pure computation over already-synced data — no external API calls, so it's fast and free to run repeatedly.
 
---
 
## 8. Create Event from Email
 
```text
User clicks "Create Event" on an open email
   ↓
Backend: run lightweight date/time pattern matcher over email.body_text + subject
         (regex/rule-based in V1 — e.g. "Thursday at 3", "3pm", "on the 28th" — no AI/NLP model)
   ↓
Return best-guess { title: email.subject, start_time?: matched-or-null }
   ↓
Frontend opens Create Event panel pre-filled, user picks target calendar/account, confirms/edits
   ↓
On submit: enqueue `create-event` job → worker calls Calendar API → writes event row with source_email_id set
```
 
If no match found, panel opens with just the title pre-filled — always a manual fallback, never blocks the user.
 
---
 
## 9. Send-as-Any-Account / Quick Reply
 
```text
User composes/replies, selects "From" account in UI
   ↓
Frontend submits { account_id, to, cc, bcc, subject, body, attachments }
   ↓
Backend enqueues `send-email` job (or sends synchronously if you want immediate feedback —
   recommend synchronous call with a loading state, since send is user-initiated and needs
   instant confirmation, not polling for job completion)
   ↓
Worker/API handler uses that account's own OAuth token — never a shared/default credential
   ↓
Gmail API: users.messages.send()
   ↓
On success: write the sent message back into emails table immediately (don't wait for next poll)
```
 
---
 
## 10. Daily Digest
 
```text
Scheduled job (per user, e.g. 7:00 AM in user's timezone) via BullMQ repeatable job
   ↓
Query: today's events (all accounts) + conflicts + unread starred/important emails since yesterday
       + tasks due today + overdue tasks
   ↓
Render as structured digest object (no AI generation — templated from data)
   ↓
Store as a Notification (type: 'digest') for in-app display
   ↓
If user has opted in to email delivery: enqueue `send-email` job using their chosen account,
   with a simple HTML template
```
 
---
 
## 11. API Surface (Next.js API routes)
 
```text
POST   /api/auth/google/connect          -- start OAuth flow
GET    /api/auth/google/callback         -- OAuth callback, creates account, queues initial sync
POST   /api/accounts/:id/sync            -- manual "Sync Now"
DELETE /api/accounts/:id                 -- disconnect
 
GET    /api/emails                       -- list, filters: account_id, status, label, q
GET    /api/emails/:id
POST   /api/emails/send
PATCH  /api/emails/:id                   -- read/unread, star, labels
DELETE /api/emails/:id
POST   /api/emails/:id/create-task
POST   /api/emails/:id/create-event      -- returns pre-filled suggestion
 
GET    /api/agenda?from=&to=             -- unified daily agenda with conflicts computed
GET    /api/events                       -- list with filters
POST   /api/events
PATCH  /api/events/:id
DELETE /api/events/:id
POST   /api/events/:id/create-task
GET    /api/events/free-slots?from=&to=&duration=
 
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
 
GET    /api/files                        -- unified attachments
 
GET    /api/search?q=
 
GET    /api/notifications
PATCH  /api/notifications/:id/read
 
GET    /api/digest/today
 
-- Internal, called by Google Pub/Sub (Phase 3b only)
POST   /api/webhooks/gmail
POST   /api/webhooks/calendar
```
 
---
 
## 12. Security
 
- OAuth `access_token` / `refresh_token` encrypted at rest (e.g. `pgcrypto` or app-level AES before insert)
- Tokens never sent to the browser — all Google API calls happen server-side (API routes or worker)
- Every DB query scoped by `user_id`; never trust a client-supplied `account_id` without verifying it belongs to the requesting user
- Progressive OAuth scopes — request Gmail read/send + Calendar read/write only, nothing broader
- Audit log table for: email sent, account connected/disconnected, event created/deleted (simple `audit_logs(user_id, action, meta, created_at)`)
- Rate-limit outbound Google API calls per account to stay under quota (BullMQ concurrency limits per queue)
---
 
## 13. Hosting & Deployment (recap, made concrete)
 
```text
Railway project: "personal-os"
 ├── web (service)      → Next.js app, public URL, connects to Postgres (read) + Redis (enqueue)
 ├── worker (service)   → Node process running BullMQ workers, connects to Postgres (write) + Redis + Google APIs
 ├── postgres (addon)
 └── redis (addon)
```
 
- `apps/web` and `apps/worker` live in one monorepo (Turborepo or plain workspaces), deployed as two separate Railway services from the same repo with different start commands
- Environment variables (Google client ID/secret, encryption key, DB/Redis URLs) set per-service in Railway
- Start with polling (§5b) — no Pub/Sub setup needed for V1 launch; add push (§5c) once the app is stable and you want lower-latency sync
---
 
## 14. Phased Development Roadmap
 
### Phase 0 — Planning (1–2 days)
- Finalize schema (this doc)
- Set up monorepo structure (`apps/web`, `apps/worker`, `packages/db`)
- Google Cloud project + OAuth consent screen + test users
### Phase 1 — Foundation (2–4 days)
- Next.js + TypeScript + Tailwind + shadcn scaffold
- Auth (app-level login) — simplest: email/password or magic link, separate from Google OAuth
- Postgres + Drizzle schema migrations
- Sidebar/nav shell, routing, empty states for every page
**Deliverable:** Login → empty dashboard shell → DB connected
 
### Phase 2 — Google Account Connection (2–4 days)
- OAuth flow (connect/callback/disconnect)
- `connected_accounts` CRUD + token encryption
- Account color/label assignment
- Connections page UI + sync status display (mocked until Phase 3)
**Deliverable:** Connect 2–3 Google accounts, see them listed with tags
 
### Phase 3 — Sync Engine + Gmail (5–8 days)
- Worker service scaffold, BullMQ setup, Redis connection
- Gmail initial sync (threads, messages, labels)
- Incremental sync via polling (§5b)
- Sync status wired to real data
- **Deliverable: working unified inbox, tagged by account**
### Phase 3b — Gmail Actions (3–5 days)
- Compose/reply/forward, send-as-any-account (§9)
- Archive/delete/star/labels, multi-select actions
- **Deliverable: usable as a daily inbox**
### Phase 4 — Calendar + Unified Agenda (5–7 days)
- Calendar sync (initial + incremental)
- Day/Week/Month/Agenda views
- **Unified Daily Agenda with double-booking highlighting (§6)** — this is the flagship feature, prioritize it
- Create/edit/delete event, attendees, recurrence
**Deliverable: unified calendar with conflict detection working**
 
### Phase 5 — Close the Loop (4–6 days)
- Create Event from Email (§8)
- Create Task from Email / from Event
- Tasks module (CRUD, filters, priority, due dates)
**Deliverable: you never have to open Gmail/Calendar directly for common actions**
 
### Phase 6 — Daily Habit Features (4–6 days)
- Free-Slot Finder (§7)
- Daily Digest (§10) — in-app first, then optional email delivery
- Notifications module
### Phase 7 — Search + Files (3–5 days)
- Postgres full-text search across emails/events/tasks
- Unified Files/attachments view (fetch-on-demand)
### Phase 8 — Polish (3–5 days)
- Loading/skeleton/error/empty states everywhere
- Keyboard shortcuts (j/k navigation, / for search, etc.)
- Responsive layout, dark mode
- Performance pass (query indexes, pagination on long lists)
### Phase 3b (later) — Push Sync
- Gmail `watch()` + Pub/Sub, Calendar push channels, webhook endpoints
- Keep polling as fallback reconciliation
**Total estimate: ~7–9 weeks solo, part-time** — slightly longer than the original estimate because the Unified Agenda + Free-Slot Finder + Digest add real engineering (conflict detection, cross-calendar computation, scheduled digest generation) beyond a plain aggregator.
 
---
 
## 15. What NOT to Build in V1
 
❌ AI assistant / summaries / email writing
❌ Vector DB / RAG
❌ Full automation engine
❌ Outlook, Notion, Slack, GitHub integrations
❌ Google Drive integration
❌ Contacts/People module
❌ Push notifications to mobile (in-app + optional digest email only)
❌ Mobile app / browser extension
 
---
 
## 16. First Milestone (what "done" looks like early)
 
> Connect two Google accounts, see a single tagged inbox and a single unified calendar with conflicts highlighted, and use it as your actual daily inbox/calendar for a week without opening Gmail directly.
 
Everything after that (free-slot finder, digest, search, files) is additive on top of a working core.