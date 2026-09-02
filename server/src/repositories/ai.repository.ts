import { db } from '../db/index.js';
import {
  userAiPreferences,
  emailAiMetadata,
  dailyDigests,
  emails,
  emailThreads,
  connectedAccounts,
  ExtractedTaskItem,
  NewsletterTopicSummary,
  DigestActionSummary,
} from '../db/schema/index.js';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';

export class AiRepository {
  // --- User AI Preferences ---
  async getUserPreferences(userId: string) {
    const [prefs] = await db
      .select()
      .from(userAiPreferences)
      .where(eq(userAiPreferences.userId, userId))
      .limit(1);
    return prefs || null;
  }

  async upsertUserPreferences(
    userId: string,
    data: Partial<{
      digestTime: string;
      digestTimezone: string;
      digestDeliveryMode: string;
      isAutoTriageEnabled: boolean;
      vipSenders: string[];
      customInstructions: string;
    }>
  ) {
    const existing = await this.getUserPreferences(userId);
    if (existing) {
      const [updated] = await db
        .update(userAiPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(userAiPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userAiPreferences)
        .values({
          userId,
          digestTime: data.digestTime || '08:00:00',
          digestTimezone: data.digestTimezone || 'UTC',
          digestDeliveryMode: data.digestDeliveryMode || 'in_app',
          isAutoTriageEnabled: data.isAutoTriageEnabled ?? true,
          vipSenders: data.vipSenders || [],
          customInstructions: data.customInstructions || null,
        })
        .returning();
      return created;
    }
  }

  // --- Email AI Metadata ---
  async saveEmailAiMetadata(data: {
    emailId: string;
    threadId: string;
    priority: string;
    urgencyScore: number;
    category: string;
    oneSentenceSummary?: string;
    newsletterTopic?: string;
    extractedTasks?: ExtractedTaskItem[];
    sentiment?: string;
  }) {
    const [saved] = await db
      .insert(emailAiMetadata)
      .values({
        emailId: data.emailId,
        threadId: data.threadId,
        priority: data.priority,
        urgencyScore: data.urgencyScore,
        category: data.category,
        oneSentenceSummary: data.oneSentenceSummary || null,
        newsletterTopic: data.newsletterTopic || null,
        extractedTasks: data.extractedTasks || null,
        sentiment: data.sentiment || null,
      })
      .onConflictDoUpdate({
        target: emailAiMetadata.emailId,
        set: {
          priority: data.priority,
          urgencyScore: data.urgencyScore,
          category: data.category,
          oneSentenceSummary: data.oneSentenceSummary || null,
          newsletterTopic: data.newsletterTopic || null,
          extractedTasks: data.extractedTasks || null,
          sentiment: data.sentiment || null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async getEmailAiMetadata(emailId: string) {
    const [record] = await db
      .select()
      .from(emailAiMetadata)
      .where(eq(emailAiMetadata.emailId, emailId))
      .limit(1);
    return record || null;
  }

  async getEmailsAiMetadataByThread(threadId: string) {
    return db
      .select()
      .from(emailAiMetadata)
      .where(eq(emailAiMetadata.threadId, threadId));
  }

  // --- AI Task Radar ---
  async getRadarTasks(userId: string) {
    const rows = await db
      .select({
        aiMetadataId: emailAiMetadata.id,
        emailId: emailAiMetadata.emailId,
        threadId: emailAiMetadata.threadId,
        priority: emailAiMetadata.priority,
        urgencyScore: emailAiMetadata.urgencyScore,
        extractedTasks: emailAiMetadata.extractedTasks,
        emailSubject: emails.subject,
        emailSender: emails.sender,
        emailReceivedAt: emails.receivedAt,
        accountColor: connectedAccounts.color,
        accountLabel: connectedAccounts.label,
        accountEmail: connectedAccounts.email,
      })
      .from(emailAiMetadata)
      .innerJoin(emails, eq(emailAiMetadata.emailId, emails.id))
      .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .where(eq(connectedAccounts.userId, userId))
      .orderBy(desc(emails.receivedAt));

    const flatTasks: Array<{
      taskId: string;
      title: string;
      type: 'assigned_to_me' | 'commitment_i_made' | 'followup_waiting_on';
      priority: 'high' | 'medium' | 'low';
      dueDate?: string;
      assignorOrAssignee?: string;
      confidence: number;
      isConverted: boolean;
      isDismissed: boolean;
      emailId: string;
      emailSubject: string | null;
      emailSender: string;
      emailReceivedAt: Date;
      accountColor: string | null;
      accountLabel: string | null;
      accountEmail: string;
    }> = [];

    for (const row of rows) {
      if (Array.isArray(row.extractedTasks)) {
        for (const task of row.extractedTasks) {
          if (!task.isDismissed) {
            flatTasks.push({
              taskId: task.id,
              title: task.title,
              type: task.type,
              priority: task.priority || 'medium',
              dueDate: task.dueDate,
              assignorOrAssignee: task.assignorOrAssignee,
              confidence: task.confidence,
              isConverted: !!task.isConverted,
              isDismissed: !!task.isDismissed,
              emailId: row.emailId,
              emailSubject: row.emailSubject,
              emailSender: row.emailSender,
              emailReceivedAt: row.emailReceivedAt,
              accountColor: row.accountColor,
              accountLabel: row.accountLabel,
              accountEmail: row.accountEmail,
            });
          }
        }
      }
    }

    return flatTasks;
  }

  async updateRadarTaskStatus(
    emailId: string,
    taskId: string,
    updates: { isConverted?: boolean; isDismissed?: boolean }
  ) {
    const record = await this.getEmailAiMetadata(emailId);
    if (!record || !Array.isArray(record.extractedTasks)) return null;

    const updatedTasks = record.extractedTasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          isConverted: updates.isConverted !== undefined ? updates.isConverted : t.isConverted,
          isDismissed: updates.isDismissed !== undefined ? updates.isDismissed : t.isDismissed,
        };
      }
      return t;
    });

    const [updated] = await db
      .update(emailAiMetadata)
      .set({
        extractedTasks: updatedTasks,
        updatedAt: new Date(),
      })
      .where(eq(emailAiMetadata.emailId, emailId))
      .returning();

    return updated;
  }

  // --- Newsletters & Digests ---
  async getNewslettersForUser(userId: string, since: Date) {
    return db
      .select({
        emailId: emails.id,
        threadId: emails.threadId,
        subject: emails.subject,
        sender: emails.sender,
        bodyText: emails.bodyText,
        snippet: emailThreads.snippet,
        receivedAt: emails.receivedAt,
        newsletterTopic: emailAiMetadata.newsletterTopic,
        oneSentenceSummary: emailAiMetadata.oneSentenceSummary,
      })
      .from(emails)
      .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
      .leftJoin(emailAiMetadata, eq(emails.id, emailAiMetadata.emailId))
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          gte(emails.receivedAt, since),
          eq(emailAiMetadata.priority, 'p4_newsletter')
        )
      )
      .orderBy(desc(emails.receivedAt));
  }

  async getUrgentEmailsForUser(userId: string, since: Date) {
    return db
      .select({
        emailId: emails.id,
        threadId: emails.threadId,
        subject: emails.subject,
        sender: emails.sender,
        bodyText: emails.bodyText,
        receivedAt: emails.receivedAt,
        oneSentenceSummary: emailAiMetadata.oneSentenceSummary,
        extractedTasks: emailAiMetadata.extractedTasks,
        urgencyScore: emailAiMetadata.urgencyScore,
      })
      .from(emails)
      .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .innerJoin(emailAiMetadata, eq(emails.id, emailAiMetadata.emailId))
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          gte(emails.receivedAt, since),
          eq(emailAiMetadata.priority, 'p1_urgent'),
          eq(emails.isRead, false)
        )
      )
      .orderBy(desc(emailAiMetadata.urgencyScore));
  }

  async saveDailyDigest(data: {
    userId: string;
    executiveGreeting: string;
    scheduleSummary?: string;
    newsletterTopics: NewsletterTopicSummary[];
    actionSummary: DigestActionSummary[];
  }) {
    const [saved] = await db
      .insert(dailyDigests)
      .values({
        userId: data.userId,
        digestDate: new Date(),
        executiveGreeting: data.executiveGreeting,
        scheduleSummary: data.scheduleSummary || null,
        newsletterTopics: data.newsletterTopics,
        actionSummary: data.actionSummary,
        isRead: false,
      })
      .returning();
    return saved;
  }

  async getLatestDigest(userId: string) {
    const [digest] = await db
      .select()
      .from(dailyDigests)
      .where(eq(dailyDigests.userId, userId))
      .orderBy(desc(dailyDigests.digestDate))
      .limit(1);
    return digest || null;
  }

  async listUserDigests(userId: string, limit = 10) {
    return db
      .select()
      .from(dailyDigests)
      .where(eq(dailyDigests.userId, userId))
      .orderBy(desc(dailyDigests.digestDate))
      .limit(limit);
  }

  async markDigestAsRead(id: string, userId: string) {
    const [updated] = await db
      .update(dailyDigests)
      .set({ isRead: true })
      .where(and(eq(dailyDigests.id, id), eq(dailyDigests.userId, userId)))
      .returning();
    return updated;
  }
}

export const aiRepository = new AiRepository();
