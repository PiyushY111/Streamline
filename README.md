# Streamline — Personal Productivity OS

Production-grade monorepo setup for Streamline Personal Productivity OS, connecting multiple Google email/calendar accounts into a single unified inbox, agenda, and task manager.
## 🏗 Repository Structure

```text
Streamline/
├── client/              # Next.js App Router (Frontend UI & API routes)
├── server/              # Node.js + TypeScript Worker Service (BullMQ sync jobs)
└── packages/
    └── db/              # Drizzle ORM Database Schema & Neon DB client connection
```

## 🚀 Stack Overview

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Zustand, React Hook Form, Zod
- **Backend / Worker**: Node.js, TypeScript, BullMQ, Redis
- **Database**: Neon PostgreSQL via Drizzle ORM (`@neondatabase/serverless`)
- **Monorepo Manager**: npm Workspaces

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
