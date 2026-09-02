# Developer Setup & Deployment Guide

This guide will help you set up, run, and test Streamline locally and prepare it for production deployment.

---

## 1. Prerequisites

* **Node.js**: `v18.0.0` or higher (Recommended: `v20.x LTS` or `v22.x`)
* **Package Manager**: `npm` (`v9.x`+)
* **Database**: [Neon PostgreSQL](https://neon.tech) (or local PostgreSQL 15+)
* **Redis**: Local Redis instance (`redis://localhost:6379`) or [Upstash Redis](https://upstash.com)
* **Google Cloud Project**: With Gmail API & Google Calendar API enabled
* **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

---

## 2. Environment Configuration

1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/PiyushY111/Streamline.git
   cd Streamline
   ```

2. Generate a 32-byte encryption key (64-character hex):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Copy `.env.example` to `.env` in the root and configure required values:
   ```bash
   cp .env.example .env
   ```

### `.env` Variable Reference:

```ini
# Environment
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:3000

# Database & Cache
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
REDIS_URL=redis://localhost:6379

# Cryptography & Sessions
ENCRYPTION_KEY=your_64_character_hex_encryption_key_here
JWT_SECRET=your_super_secret_jwt_signing_key_min_16_chars

# Google Workspace OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback

# Gemini AI Engine
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
```

---

## 3. Google Cloud Console Configuration

1. Visit [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the following APIs in **APIs & Services > Library**:
   * **Gmail API**
   * **Google Calendar API**
   * **Google People API** (Contacts)
4. Go to **APIs & Services > OAuth consent screen**:
   * Set user type to **External**.
   * Add test users (your email addresses).
   * Add required scopes:
     * `.../auth/userinfo.email`
     * `.../auth/userinfo.profile`
     * `.../auth/gmail.readonly`
     * `.../auth/gmail.modify`
     * `.../auth/gmail.send`
     * `.../auth/calendar`
5. Go to **Credentials > Create Credentials > OAuth client ID**:
   * Application type: **Web application**
   * Authorized redirect URIs: `http://localhost:5001/api/auth/google/callback`

---

## 4. Install & Database Migration

```bash
# Install dependencies across all workspaces
npm install

# Run database schema push / migrations
npm run db:push --workspace=@streamline/server

# (Optional) Open Drizzle Studio Web Inspector
npm run db:studio --workspace=@streamline/server
```

---

## 5. Running the Application

### Start All Services in Development Mode:
In separate terminal windows:

1. **Start Redis** (if running locally):
   ```bash
   redis-server
   ```

2. **Start Backend Server & Background Workers**:
   ```bash
   cd server
   npm run dev
   ```

3. **Start Next.js Frontend Application**:
   ```bash
   cd client
   npm run dev
   ```

Visit **`http://localhost:3000`** in your browser to sign up and connect your Google accounts!

---

## 6. Verification & Automated Tests

```bash
# Run server test suite (Vitest)
npm test --workspace=@streamline/server

# Run client type checking
npm run type-check --workspace=@streamline/client

# Run server type checking
npm run type-check --workspace=@streamline/server
```
