import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

export class AccountsRepository {
  async findByUserId(userId: string) {
    return db.select().from(connectedAccounts).where(eq(connectedAccounts.userId, userId));
  }

  async findById(id: string) {
    const [account] = await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, id)).limit(1);
    return account || null;
  }

  async findByUserAndProviderAccountId(userId: string, providerAccountId: string) {
    const [account] = await db.select().from(connectedAccounts).where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.providerAccountId, providerAccountId)
      )
    ).limit(1);
    return account || null;
  }

  async upsertAccount(data: {
    userId: string;
    providerAccountId: string;
    email: string;
    label: string;
    color: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    scopes: string;
    avatar?: string;
  }) {
    const existing = await this.findByUserAndProviderAccountId(data.userId, data.providerAccountId);
    if (existing) {
      const [updated] = await db.update(connectedAccounts)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db.insert(connectedAccounts).values({
      userId: data.userId,
      providerAccountId: data.providerAccountId,
      email: data.email,
      label: data.label,
      color: data.color,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      scopes: data.scopes,
      avatar: data.avatar,
    }).returning();
    return inserted;
  }

  async delete(id: string, userId: string) {
    return db.delete(connectedAccounts).where(
      and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, userId))
    );
  }

  async updateAccountDetails(id: string, userId: string, data: { label?: string; color?: string }) {
    const updatePayload: Record<string, any> = { updatedAt: new Date() };
    if (data.label !== undefined) updatePayload.label = data.label;
    if (data.color !== undefined) updatePayload.color = data.color;

    const [updated] = await db.update(connectedAccounts)
      .set(updatePayload)
      .where(and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, userId)))
      .returning();

    return updated || null;
  }
}

export const accountsRepository = new AccountsRepository();
