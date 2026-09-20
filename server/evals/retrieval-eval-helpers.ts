import { db } from '../src/db/index.js';
import { memories, users } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { AiProvider } from '../src/services/ai/core/types.js';
import { SEED_EVAL_MEMORIES } from './seed-memory-eval-data.js';

/**
 * Resolves (or creates) a dedicated eval user so seeded memories never mix with a real
 * account's data. `memories` has a NOT NULL FK to `users`, so a real row is required.
 * Shared by retrieval-precision.eval.ts and retrieval-ablation.eval.ts so both suites seed
 * identically and can't silently drift from each other.
 */
export async function ensureEvalUser(email: string): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(users).values({ email }).returning({ id: users.id });
  return created.id;
}

export async function reseedEvalMemories(userId: string, provider: AiProvider): Promise<void> {
  await db.delete(memories).where(eq(memories.userId, userId));
  for (const m of SEED_EVAL_MEMORIES) {
    const embedding = await provider.generateEmbedding(m.content, { dimensions: 768 });
    await db.insert(memories).values({
      userId,
      type: m.type,
      content: m.content,
      sourceRef: m.sourceRef,
      embedding,
      status: 'active',
    });
  }
}

export async function clearEvalMemories(userId: string): Promise<void> {
  await db.delete(memories).where(eq(memories.userId, userId));
}
