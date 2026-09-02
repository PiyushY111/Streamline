# REST API Specification

Base URL: `http://localhost:5001/api` (or proxied through Next.js at `/api`)

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register`
Create a new user account.
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "Jane Doe"
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "user": {
      "id": "c1f7b0a8-9d21-4f1e-9b55-6b2a0c4f8e21",
      "email": "user@example.com",
      "name": "Jane Doe",
      "avatar": null
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "csrfToken": "a8f9c2d1..."
  }
  ```
* **Cookies Set**: `session_token` (`httpOnly`), `csrf_token`.

### `POST /api/auth/login`
Authenticate with email and password. Automatically triggers background mailbox synchronization.
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
* **Response `200 OK`**: Same schema as register.

### `GET /api/auth/me`
Retrieve currently authenticated user profile.
* **Headers**: `Cookie: session_token=...`
* **Response `200 OK`**: `{ "user": { ... }, "csrfToken": "..." }`

### `POST /api/auth/logout`
Clears session and CSRF cookies.

---

## 2. Connected Accounts (`/api/accounts`)

### `GET /api/accounts`
List all connected Google accounts owned by the authenticated user.
* **Response `200 OK`** (Tokens are sanitized and never returned):
  ```json
  {
    "accounts": [
      {
        "id": "5909bc6e-5002-4a66-9072-230ea8266f67",
        "providerAccountId": "1049284029102",
        "email": "jane.doe@gmail.com",
        "label": "Work Gmail",
        "color": "#3b82f6",
        "avatar": "https://lh3.googleusercontent.com/...",
        "status": "active",
        "scopes": "https://www.googleapis.com/auth/gmail.readonly ...",
        "createdAt": "2026-08-20T10:00:00.000Z",
        "updatedAt": "2026-09-02T12:00:00.000Z"
      }
    ]
  }
  ```

### `PATCH /api/accounts/:id`
Update display label or color badge.
* **Request Body**: `{ "label": "Personal Gmail", "color": "#10b981" }`
* **Response `200 OK`**: `{ "success": true, "account": { ... } }`

### `DELETE /api/accounts/:id`
Disconnect account and purge associated sync state.

---

## 3. Emails & Inbox (`/api/emails`)

### `GET /api/emails`
Retrieve synchronized emails joined with AI metadata.
* **Query Parameters**:
  * `folder`: `inbox` | `sent` | `drafts` | `trash` (Default: `inbox`)
  * `limit`: Max items (Default: `1000`)
  * `page`: Page index (Default: `1`)
* **Response `200 OK`**:
  ```json
  {
    "emails": [
      {
        "id": "28a2a685-7f32-4151-aa17-b9bfb6572796",
        "threadId": "38a0f9b1-2e11-4a7b-8c20-410d9e2a87b1",
        "accountId": "5909bc6e-5002-4a66-9072-230ea8266f67",
        "sender": "CSAI Office <csai@university.edu>",
        "subject": "Important: Computer Networks Contest 1",
        "receivedAt": "2026-09-01T14:30:00.000Z",
        "isRead": false,
        "isStarred": true,
        "aiPriority": "p1_urgent",
        "aiUrgencyScore": 90,
        "aiSummary": "CSAI Office announced Contest 1 on Sept 4 requiring student MacBook verification.",
        "aiNewsletterTopic": "🎓 Academics",
        "aiExtractedTasks": [
          { "id": "task-1", "title": "Bring MacBook and Student ID", "priority": "high" }
        ],
        "accountName": "University Mailbox",
        "accountColor": "#3b82f6"
      }
    ]
  }
  ```

### `POST /api/emails/send`
Send an email message via Gmail API.
* **Request Body**:
  ```json
  {
    "to": "colleague@example.com",
    "subject": "Meeting Follow-up",
    "body": "Here are the meeting notes...",
    "accountId": "5909bc6e-5002-4a66-9072-230ea8266f67"
  }
  ```

---

## 4. Gemini AI Intelligence (`/api/ai`)

### `POST /api/ai/draft-reply` (Server-Sent Events)
Stream contextual AI draft reply for a thread.
* **Request Body**:
  ```json
  {
    "threadId": "38a0f9b1-2e11-4a7b-8c20-410d9e2a87b1",
    "tone": "professional",
    "customPrompt": "Confirm attendance and ask for the slide deck"
  }
  ```
* **Response**: `Content-Type: text/event-stream` (Streamed JSON chunks).

### `POST /api/ai/triage/all`
Trigger batch Gemini triage across all unclassified emails in user accounts.

### `GET /api/ai/tasks/radar`
Get high-priority extracted action items across all recent emails.

### `POST /api/ai/tasks/convert`
Convert an AI-extracted radar task into an official Streamline task.
* **Request Body**:
  ```json
  {
    "emailId": "28a2a685-7f32-4151-aa17-b9bfb6572796",
    "taskId": "task-1",
    "title": "Bring MacBook and Student ID",
    "priority": "high",
    "dueDate": "2026-09-04T09:00:00.000Z"
  }
  ```

### `GET /api/ai/digest/latest`
Retrieve the latest synthesized Daily Executive & Newsletter Digest.

### `GET /api/ai/usage`
Retrieve real-time token tracking, USD costs, and circuit breaker status for the authenticated user.
* **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "today": {
        "tokens": 42150,
        "costUsd": 0.004125,
        "tokenLimit": 250000,
        "costLimitUsd": 0.50,
        "percentUsed": 16.86
      },
      "last30Days": {
        "tokens": 894200,
        "costUsd": 0.087210
      },
      "breakdown": [
        { "operation": "triage", "tokens": 620100, "costUsd": 0.051200 },
        { "operation": "reply_draft", "tokens": 194100, "costUsd": 0.024800 },
        { "operation": "digest", "tokens": 80000, "costUsd": 0.011210 }
      ],
      "circuitBreaker": {
        "isTripped": false
      }
    }
  }
  ```

