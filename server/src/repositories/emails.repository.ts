import { db } from '../db/index.js';
import { emails, emailThreads, connectedAccounts } from '../db/schema/index.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

export class EmailsRepository {
  async listUserEmails(userId: string, folder: string = 'inbox') {
    const userAccounts = await db.select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountIds = userAccounts.map((a: { id: string }) => a.id);

    return db.select()
      .from(emails)
      .where(and(
        inArray(emails.accountId, accountIds),
        eq(emails.folder, folder)
      ))
      .orderBy(desc(emails.receivedAt));
  }

  async findById(id: string) {
    const [email] = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
    return email || null;
  }

  async markAsRead(id: string, isRead: boolean = true) {
    const [updated] = await db.update(emails)
      .set({ isRead, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return updated;
  }

  async toggleStar(id: string, isStarred: boolean) {
    const [updated] = await db.update(emails)
      .set({ isStarred, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return updated;
  }

  async deleteEmail(id: string) {
    return db.delete(emails).where(eq(emails.id, id));
  }
}

export const emailsRepository = new EmailsRepository();
