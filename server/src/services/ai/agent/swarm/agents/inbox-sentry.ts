import { db } from '../../../../../db/index.js';
import { emails, connectedAccounts, emailAiMetadata } from '../../../../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { getAiProvider } from '../../../core/factory.js';
import { logger } from '../../../../../utils/logger.js';
import { toError } from '../../../../../utils/errors.js';

export interface InboxSentryOutput {
  threadsAnalyzed: number;
  urgentItemsFound: Array<{ id: string; subject: string; sender: string; snippet: string }>;
  keyCommitments: string[];
  summary: string;
}

export class InboxSentryAgent {
  public async execute(userId: string, instruction: string): Promise<InboxSentryOutput> {
    logger.info({ userId, instruction }, 'Inbox Sentry Agent executing...');

    // Fetch recent unread or urgent emails
    const recentEmails = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        sender: emails.sender,
        bodyText: emails.bodyText,
        urgencyScore: emailAiMetadata.urgencyScore,
        receivedAt: emails.receivedAt,
      })
      .from(emails)
      .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .leftJoin(emailAiMetadata, eq(emails.id, emailAiMetadata.emailId))
      .where(and(eq(connectedAccounts.userId, userId), eq(emails.folder, 'inbox')))
      .orderBy(desc(emails.receivedAt))
      .limit(10);

    const urgent = recentEmails
      .filter((e) => (e.urgencyScore || 0) >= 60 || /urgent|asap|important|deadline/i.test(e.subject || ''))
      .map((e) => ({
        id: e.id,
        subject: e.subject || 'No Subject',
        sender: e.sender,
        snippet: (e.bodyText || '').slice(0, 150),
      }));

    const provider = getAiProvider();
    let summary = `Scanned ${recentEmails.length} recent messages, found ${urgent.length} urgent items.`;
    let keyCommitments: string[] = [];

    if (provider && provider.isAvailable() && recentEmails.length > 0) {
      const emailContext = recentEmails
        .map((e) => `From: ${e.sender} | Subject: ${e.subject} | Snippet: ${(e.bodyText || '').slice(0, 150)}`)
        .join('\n');
      try {
        const res = await provider.generateStructuredJson<{ summary: string; commitments: string[] }>({
          prompt: `You are the Inbox Sentry Agent. Analyze these emails according to this instruction: "${instruction}".
Emails:
${emailContext}

Output JSON:
{
  "summary": "Concise executive briefing of relevant email state",
  "commitments": ["Any promises or deadlines detected like 'I will send this by Tuesday'"]
}`,
          models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
        });

        if (res?.summary) {
          summary = res.summary;
          keyCommitments = res.commitments || [];
        }
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        logger.warn({ err: err.message }, 'Inbox Sentry LLM parsing fallback');
      }
    }

    return {
      threadsAnalyzed: recentEmails.length,
      urgentItemsFound: urgent,
      keyCommitments,
      summary,
    };
  }
}

export const inboxSentryAgent = new InboxSentryAgent();
