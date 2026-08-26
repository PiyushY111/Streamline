import { db } from '../db/index.js';
import { emails, emailThreads, connectedAccounts } from '../db/schema/index.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

export class EmailsRepository {
  async listUserEmails(userId: string, folder: string = 'inbox', limit: number = 1000, page: number = 1) {
    const userAccounts = await db.select({
      id: connectedAccounts.id,
      label: connectedAccounts.label,
      email: connectedAccounts.email,
      color: connectedAccounts.color,
    })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountMap = new Map(userAccounts.map(a => [a.id, a]));
    const accountIds = userAccounts.map(a => a.id);
    const offset = (page - 1) * limit;

    const emailRows = await db.select({
      id: emails.id,
      threadId: emails.threadId,
      accountId: emails.accountId,
      externalMessageId: emails.externalMessageId,
      sender: emails.sender,
      recipients: emails.recipients,
      subject: emails.subject,
      bodyText: emails.bodyText,
      receivedAt: emails.receivedAt,
      sentAt: emails.sentAt,
      folder: emails.folder,
      category: emails.category,
      isRead: emails.isRead,
      isStarred: emails.isStarred,
      isImportant: emails.isImportant,
    })
      .from(emails)
      .where(and(
        inArray(emails.accountId, accountIds),
        eq(emails.folder, folder)
      ))
      .orderBy(desc(emails.receivedAt))
      .limit(limit)
      .offset(offset);

    return emailRows.map(e => {
      const acc = accountMap.get(e.accountId);
      const { bodyText, ...rest } = e;
      return {
        ...rest,
        snippet: bodyText ? bodyText.substring(0, 120).replace(/\s+/g, ' ').trim() : '(No content snippet)',
        accountName: acc?.label || acc?.email || 'Mailbox',
        accountEmail: acc?.email || '',
        accountColor: acc?.color || '#3b82f6',
      };
    });
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

  async updateCategory(id: string, category: string) {
    const [updated] = await db.update(emails)
      .set({ category, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return updated;
  }

  async deleteEmail(id: string) {
    return db.delete(emails).where(eq(emails.id, id));
  }

  async createSentEmail(data: {
    userId: string;
    to: string;
    subject: string;
    body: string;
    accountId?: string;
    externalMessageId?: string;
  }) {
    let accountId = data.accountId;
    if (!accountId) {
      const userAccounts = await db.select({ id: connectedAccounts.id })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, data.userId))
        .limit(1);
      if (userAccounts.length > 0) {
        accountId = userAccounts[0].id;
      }
    }

    if (!accountId) {
      throw new Error('No connected Google account found. Please connect an account first.');
    }

    const extId = data.externalMessageId || `sent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let [thread] = await db.select().from(emailThreads).where(eq(emailThreads.accountId, accountId)).limit(1);
    if (!thread) {
      [thread] = await db.insert(emailThreads).values({
        accountId,
        externalThreadId: extId,
        subject: data.subject || '(No Subject)',
        snippet: data.body.substring(0, 100),
        lastMessageAt: new Date(),
      }).returning();
    }

    const [sentEmail] = await db.insert(emails).values({
      threadId: thread.id,
      accountId,
      externalMessageId: extId,
      sender: 'me',
      recipients: data.to,
      subject: data.subject || '(No Subject)',
      bodyText: data.body,
      receivedAt: new Date(),
      sentAt: new Date(),
      folder: 'sent',
      isRead: true,
    }).returning();

    const [acc] = await db.select({
      label: connectedAccounts.label,
      email: connectedAccounts.email,
      color: connectedAccounts.color,
    }).from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).limit(1);

    return {
      ...sentEmail,
      accountName: acc?.label || acc?.email || 'Mailbox',
      accountEmail: acc?.email || '',
      accountColor: acc?.color || '#3b82f6',
    };
  }
}

export const emailsRepository = new EmailsRepository();
