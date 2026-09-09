import { db } from '../db/index.js';
import { emails, emailThreads, connectedAccounts, emailAiMetadata } from '../db/schema/index.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';

export class EmailsRepository {
  private async getUserAccountIds(userId: string): Promise<string[]> {
    const userAccounts = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));
    return userAccounts.map((a) => a.id);
  }

  async listUserEmails(userId: string, folder: string = 'inbox', limit: number = 50, page: number = 1) {
    const userAccounts = await db
      .select({
        id: connectedAccounts.id,
        label: connectedAccounts.label,
        email: connectedAccounts.email,
        color: connectedAccounts.color,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    if (userAccounts.length === 0) return [];

    const accountMap = new Map(userAccounts.map((a) => [a.id, a]));
    const accountIds = userAccounts.map((a) => a.id);
    const offset = (page - 1) * limit;

    // Optimized projection: Omit full multi-megabyte bodyHtml/bodyText from list queries
    const emailRows = await db
      .select({
        id: emails.id,
        threadId: emails.threadId,
        accountId: emails.accountId,
        externalMessageId: emails.externalMessageId,
        sender: emails.sender,
        recipients: emails.recipients,
        subject: emails.subject,
        snippet: sql<string>`SUBSTRING(COALESCE(${emails.bodyText}, ''), 1, 200)`,
        receivedAt: emails.receivedAt,
        sentAt: emails.sentAt,
        folder: emails.folder,
        category: emails.category,
        isRead: emails.isRead,
        isStarred: emails.isStarred,
        isImportant: emails.isImportant,
        aiPriority: emailAiMetadata.priority,
        aiUrgencyScore: emailAiMetadata.urgencyScore,
        aiSummary: emailAiMetadata.oneSentenceSummary,
        aiNewsletterTopic: emailAiMetadata.newsletterTopic,
        aiSentiment: emailAiMetadata.sentiment,
        aiExtractedTasks: emailAiMetadata.extractedTasks,
      })
      .from(emails)
      .leftJoin(emailAiMetadata, eq(emails.id, emailAiMetadata.emailId))
      .where(and(inArray(emails.accountId, accountIds), eq(emails.folder, folder)))
      .orderBy(desc(emails.receivedAt))
      .limit(limit)
      .offset(offset);

    return emailRows.map((e) => {
      const acc = accountMap.get(e.accountId);
      const cleanSnippet = e.snippet ? e.snippet.replace(/\s+/g, ' ').trim() : '(No content snippet)';
      return {
        ...e,
        bodyText: '',
        bodyHtml: '',
        snippet: cleanSnippet,
        accountName: acc?.label || acc?.email || 'Mailbox',
        accountEmail: acc?.email || '',
        accountColor: acc?.color || '#3b82f6',
      };
    });
  }

  async findById(id: string, userId: string) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return null;

    const [email] = await db
      .select({
        id: emails.id,
        threadId: emails.threadId,
        accountId: emails.accountId,
        externalMessageId: emails.externalMessageId,
        sender: emails.sender,
        recipients: emails.recipients,
        cc: emails.cc,
        bcc: emails.bcc,
        subject: emails.subject,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        receivedAt: emails.receivedAt,
        sentAt: emails.sentAt,
        folder: emails.folder,
        category: emails.category,
        isRead: emails.isRead,
        isStarred: emails.isStarred,
        isImportant: emails.isImportant,
        attachments: emails.attachments,
        createdAt: emails.createdAt,
        updatedAt: emails.updatedAt,
        aiPriority: emailAiMetadata.priority,
        aiUrgencyScore: emailAiMetadata.urgencyScore,
        aiSummary: emailAiMetadata.oneSentenceSummary,
        aiNewsletterTopic: emailAiMetadata.newsletterTopic,
        aiSentiment: emailAiMetadata.sentiment,
        aiExtractedTasks: emailAiMetadata.extractedTasks,
      })
      .from(emails)
      .leftJoin(emailAiMetadata, eq(emails.id, emailAiMetadata.emailId))
      .where(and(eq(emails.id, id), inArray(emails.accountId, accountIds)))
      .limit(1);

    return email || null;
  }

  async getEmailById(userId: string, emailId: string) {
    return this.findById(emailId, userId);
  }

  async markAsRead(id: string, userId: string, isRead: boolean = true) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return null;

    const [updated] = await db
      .update(emails)
      .set({ isRead, updatedAt: new Date() })
      .where(and(eq(emails.id, id), inArray(emails.accountId, accountIds)))
      .returning();

    return updated || null;
  }

  async toggleStar(id: string, userId: string, isStarred: boolean) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return null;

    const [updated] = await db
      .update(emails)
      .set({ isStarred, updatedAt: new Date() })
      .where(and(eq(emails.id, id), inArray(emails.accountId, accountIds)))
      .returning();

    return updated || null;
  }

  async updateCategory(id: string, userId: string, category: string) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return null;

    const [updated] = await db
      .update(emails)
      .set({ category, updatedAt: new Date() })
      .where(and(eq(emails.id, id), inArray(emails.accountId, accountIds)))
      .returning();

    return updated || null;
  }

  async deleteEmail(id: string, userId: string) {
    const accountIds = await this.getUserAccountIds(userId);
    if (accountIds.length === 0) return { rowCount: 0 };

    return db
      .delete(emails)
      .where(and(eq(emails.id, id), inArray(emails.accountId, accountIds)));
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
    if (accountId) {
      const [acc] = await db
        .select({ id: connectedAccounts.id })
        .from(connectedAccounts)
        .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, data.userId)))
        .limit(1);
      if (!acc) {
        throw new Error('Specified account does not belong to the authenticated user.');
      }
    } else {
      const userAccounts = await db
        .select({ id: connectedAccounts.id })
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

    let [thread] = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.accountId, accountId))
      .limit(1);

    if (!thread) {
      [thread] = await db
        .insert(emailThreads)
        .values({
          accountId,
          externalThreadId: extId,
          subject: data.subject || '(No Subject)',
          snippet: data.body.substring(0, 100),
          lastMessageAt: new Date(),
        })
        .returning();
    }

    const [sentEmail] = await db
      .insert(emails)
      .values({
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
      })
      .returning();

    const [acc] = await db
      .select({
        label: connectedAccounts.label,
        email: connectedAccounts.email,
        color: connectedAccounts.color,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
      .limit(1);

    return {
      ...sentEmail,
      accountName: acc?.label || acc?.email || 'Mailbox',
      accountEmail: acc?.email || '',
      accountColor: acc?.color || '#3b82f6',
    };
  }
}

export const emailsRepository = new EmailsRepository();
