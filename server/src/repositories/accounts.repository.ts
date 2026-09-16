import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

export class AccountsRepository {
  // Public/Safe method for API responses - NEVER leaks tokens
  async findByUserId(userId: string) {
    return db
      .select({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));
  }

  // Internal method with tokens strictly for backend background sync workers
  async findInternalById(id: string) {
    const [account] = await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, id)).limit(1);
    return account || null;
  }

  async findById(id: string) {
    const [account] = await db
      .select({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, id))
      .limit(1);
    return account || null;
  }

  async findByIdAndUserId(id: string, userId: string) {
    const [account] = await db
      .select({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, userId)))
      .limit(1);
    return account || null;
  }

  async findByUserAndProviderAccountId(userId: string, providerAccountId: string) {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.providerAccountId, providerAccountId)))
      .limit(1);
    return account || null;
  }

  async upsertAccount(data: {
    userId: string;
    providerAccountId: string;
    email: string;
    label: string;
    color: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: Date;
    scopes: string;
    avatar?: string;
  }) {
    const existing = await this.findByUserAndProviderAccountId(data.userId, data.providerAccountId);
    if (existing) {
      // Preserve existing valid refreshToken if new token is not provided by Google
      const finalRefreshToken =
        data.refreshToken && data.refreshToken.trim().length > 0 ? data.refreshToken : existing.refreshToken;

      const [updated] = await db
        .update(connectedAccounts)
        .set({
          accessToken: data.accessToken,
          refreshToken: finalRefreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, existing.id))
        .returning({
          id: connectedAccounts.id,
          providerAccountId: connectedAccounts.providerAccountId,
          email: connectedAccounts.email,
          label: connectedAccounts.label,
          color: connectedAccounts.color,
          avatar: connectedAccounts.avatar,
          status: connectedAccounts.status,
          scopes: connectedAccounts.scopes,
          createdAt: connectedAccounts.createdAt,
          updatedAt: connectedAccounts.updatedAt,
        });
      return updated;
    }

    const [inserted] = await db
      .insert(connectedAccounts)
      .values({
        userId: data.userId,
        providerAccountId: data.providerAccountId,
        email: data.email,
        label: data.label,
        color: data.color,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || data.accessToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        avatar: data.avatar,
        status: 'active',
      })
      .returning({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      });
    return inserted;
  }

  async delete(id: string, userId: string) {
    return db.delete(connectedAccounts).where(and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, userId)));
  }

  async updateAccountDetails(id: string, userId: string, data: { label?: string; color?: string }) {
    const updatePayload: Record<string, any> = { updatedAt: new Date() };
    if (data.label !== undefined) updatePayload.label = data.label;
    if (data.color !== undefined) updatePayload.color = data.color;

    const [updated] = await db
      .update(connectedAccounts)
      .set(updatePayload)
      .where(and(eq(connectedAccounts.id, id), eq(connectedAccounts.userId, userId)))
      .returning({
        id: connectedAccounts.id,
        providerAccountId: connectedAccounts.providerAccountId,
        email: connectedAccounts.email,
        label: connectedAccounts.label,
        color: connectedAccounts.color,
        avatar: connectedAccounts.avatar,
        status: connectedAccounts.status,
        scopes: connectedAccounts.scopes,
        createdAt: connectedAccounts.createdAt,
        updatedAt: connectedAccounts.updatedAt,
      });

    return updated || null;
  }

  async updateAccountStatus(id: string, status: 'active' | 'error' | 'disconnected', error?: string, userId?: string) {
    const conditions = [eq(connectedAccounts.id, id)];
    if (userId) {
      conditions.push(eq(connectedAccounts.userId, userId));
    }
    const [updated] = await db
      .update(connectedAccounts)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning({
        id: connectedAccounts.id,
        status: connectedAccounts.status,
        updatedAt: connectedAccounts.updatedAt,
      });
    return updated || null;
  }
}

export const accountsRepository = new AccountsRepository();
