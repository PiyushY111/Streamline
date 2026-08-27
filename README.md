# Streamline — Personal Productivity OS

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![Database](https://img.shields.io/badge/Database-NeonDB%20%7C%20Drizzle-blueviolet)

Production-grade monorepo setup for **Streamline Personal Productivity OS**, connecting multiple Google email/calendar accounts into a single unified inbox, agenda, and task manager.

---

## ✨ Key Features

- 📬 **Unified Inbox**: Aggregates emails across multiple Google accounts into a synchronized feed.
- 📅 **Smart Calendar Agenda**: Single view for schedules, events, and automated conflict resolution.
- ⚡ **Background Job Processing**: Reliable async synchronization powered by BullMQ & Redis.
- 🔐 **Multi-Account OAuth**: Secure Google OAuth authentication and token lifecycle management.
- 🗄️ **Serverless PostgreSQL**: Scalable database layer using Neon Postgres and Drizzle ORM.

---

## 🏗 Repository Structure

```text
Streamline/
├── client/              # Next.js App Router (Frontend UI & API routes)
├── server/              # Node.js + TypeScript Worker Service (BullMQ sync jobs)
└── packages/
    └── db/              # Drizzle ORM Database Schema & Neon DB client connection
```

## 📐 Architecture & System Design

```text
+-------------------------------------------------------------+
|                     Next.js Frontend App                    |
|      (App Router UI, TanStack Query, Zustand State)          |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                  Neon PostgreSQL Database                   |
|           (Drizzle ORM Schema, Users, Tokens, Events)       |
+------------------------------+------------------------------+
                               ^
                               |
+------------------------------+------------------------------+
|                    BullMQ Worker Service                    |
|       (Google API Sync, Token Refresh, Email Ingestion)     |
+-------------------------------------------------------------+
```

### Core Architecture Components

- **Client App (`/client`)**: Modern Next.js 14 web application featuring full responsive design, email thread visualizers, and interactive calendar controls.
- **Worker Service (`/server`)**: Standalone background worker consuming queues for email synchronization, periodic polling, and token refreshing without blocking user requests.
- **Database Package (`/packages/db`)**: Shared package encapsulating Drizzle ORM schemas, migrations, and serverless Postgres connections.

---

## 🚀 Stack Overview

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Zustand, React Hook Form, Zod
- **Backend / Worker**: Node.js, TypeScript, BullMQ, Redis
- **Database**: Neon PostgreSQL via Drizzle ORM (`@neondatabase/serverless`)
- **Monorepo Manager**: npm Workspaces

---

## 🛠 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Neon DB connection string and credentials:

```bash
cp .env.example .env
```

### 3. Database Management

```bash
# Push schema changes to Neon DB
npm run db:push

# Open Drizzle Studio UI
npm run db:studio
```

### 4. Development Servers

```bash
# Run Next.js Frontend
npm run dev

# Run Worker Service
npm run dev:worker
```

---

## 🗺️ Product Roadmap

- [x] Multi-account OAuth connection setup
- [x] Initial sync worker pipeline using BullMQ
- [x] Unified inbox view with label filtering
- [ ] AI-assisted email summarization & smart reply draft generator
- [ ] Cross-calendar scheduling conflict auto-resolution
- [ ] Desktop notifications & offline support

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin main`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
