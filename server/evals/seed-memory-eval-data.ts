import { MemoryType } from '../src/services/ai/memory/memory.service.js';

export interface SeedMemoryItem {
  type: MemoryType;
  content: string;
  sourceRef: string;
}

export const SEED_EVAL_MEMORIES: SeedMemoryItem[] = [
  // Preferences
  {
    type: 'preference',
    content: 'Rules for daily scheduling: I prefer deep work in the morning between 8am and 12pm, and meetings after 2pm.',
    sourceRef: 'eval:pref:1',
  },
  {
    type: 'preference',
    content: 'I usually overestimate how long coding tasks take by about 25%.',
    sourceRef: 'eval:pref:2',
  },
  {
    type: 'preference',
    content: 'I prefer dark mode across all my development tools and applications.',
    sourceRef: 'eval:pref:3',
  },
  {
    type: 'preference',
    content: 'Always decline meeting invitations that lack an explicit agenda or purpose.',
    sourceRef: 'eval:pref:4',
  },
  {
    type: 'preference',
    content: 'I like 15-minute buffer breaks between back-to-back calendar events.',
    sourceRef: 'eval:pref:5',
  },
  {
    type: 'preference',
    content: 'For drafting emails, keep responses under three paragraphs and avoid fluffy pleasantries.',
    sourceRef: 'eval:pref:6',
  },
  {
    type: 'preference',
    content: 'Schedule external recruiter or vendor calls only on Thursday afternoons.',
    sourceRef: 'eval:pref:7',
  },
  {
    type: 'preference',
    content: 'Weekly routine: Reserve Fridays exclusively for code reviews, refactoring, and planning at the end of the week.',
    sourceRef: 'eval:pref:8',
  },

  // Decisions
  {
    type: 'decision',
    content: 'Decided to use PostgreSQL over MongoDB for Streamline for relational integrity and pgvector support.',
    sourceRef: 'eval:dec:1',
  },
  {
    type: 'decision',
    content: 'Decided to defer GitHub issues and PR sync indefinitely to keep MVP scope tightly focused.',
    sourceRef: 'eval:dec:2',
  },
  {
    type: 'decision',
    content: 'Decided to adopt Server-Sent Events (SSE) over WebSockets for AI draft streaming.',
    sourceRef: 'eval:dec:3',
  },
  {
    type: 'decision',
    content: 'Decided to use BullMQ with Redis for background queue and periodic synchronization processing.',
    sourceRef: 'eval:dec:4',
  },
  {
    type: 'decision',
    content: 'Decided to classify save_memory tool as read in policy engine due to zero external blast radius.',
    sourceRef: 'eval:dec:5',
  },
  {
    type: 'decision',
    content: 'Decided on AES-256-GCM for encrypting Google OAuth refresh tokens at application layer.',
    sourceRef: 'eval:dec:6',
  },
  {
    type: 'decision',
    content: 'Decided on HNSW indexing over IVFFlat for vector cosine similarity search.',
    sourceRef: 'eval:dec:7',
  },
  {
    type: 'decision',
    content: 'Decided to reject any unapproved pending approval write actions after 24-hour expiration TTL.',
    sourceRef: 'eval:dec:8',
  },

  // Project Facts
  {
    type: 'project_fact',
    content: 'Streamline backend is built with Node.js, Express, TypeScript, and Drizzle ORM.',
    sourceRef: 'eval:fact:1',
  },
  {
    type: 'project_fact',
    content: 'Draftly project uses Liveblocks and Y.js for real-time multiplayer CRDT state synchronization.',
    sourceRef: 'eval:fact:2',
  },
  {
    type: 'project_fact',
    content: 'Neon serverless Postgres is used with database branch-first isolation.',
    sourceRef: 'eval:fact:3',
  },
  {
    type: 'project_fact',
    content: 'Streamline uses BullMQ with Redis for background queue and periodic asynchronous worker processing.',
    sourceRef: 'eval:fact:4',
  },
  {
    type: 'project_fact',
    content: 'Automated database backups run daily at 02:00 UTC with 30-day point-in-time recovery.',
    sourceRef: 'eval:fact:5',
  },
  {
    type: 'project_fact',
    content: 'AI task priority scoring uses a 5-factor exponential urgency decay model with 48h half-life.',
    sourceRef: 'eval:fact:6',
  },
  {
    type: 'project_fact',
    content: 'External calendar slot finder reserves a mandatory 10-minute transit buffer before events.',
    sourceRef: 'eval:fact:7',
  },
  {
    type: 'project_fact',
    content: 'Cost guard circuit breaker automatically halts AI generation if daily budget exceeds $1.00 USD.',
    sourceRef: 'eval:fact:8',
  },
  {
    type: 'project_fact',
    content: 'Vector embeddings for memory use 768 dimensions across all supported AI providers.',
    sourceRef: 'eval:fact:9',
  },
  {
    type: 'project_fact',
    content: 'Newsletter digest extracts key insights from Substack and Medium subscriptions every morning at 7am.',
    sourceRef: 'eval:fact:10',
  },
  {
    type: 'project_fact',
    content: 'Kahns topological sorting algorithm is used to detect cyclic dependencies in project tasks.',
    sourceRef: 'eval:fact:11',
  },
];
