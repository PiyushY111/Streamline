import { getGeminiClient, PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from './gemini.client.js';
import { db } from '../../db/index.js';
import { emails, emailThreads, connectedAccounts } from '../../db/schema/index.js';
import { eq, and, asc, desc, or } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { aiRepository } from '../../repositories/ai.repository.js';
import { Response } from 'express';

export interface DraftOptions {
  threadId?: string;
  emailId?: string;
  userId: string;
  tone?: 'professional' | 'concise' | 'friendly' | 'decline' | 'counter_propose';
  customPrompt?: string;
  emailContext?: string;
  replyType?: 'reply' | 'reply_all';
}

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function streamDraftReply(options: DraftOptions, res: Response): Promise<void> {
  const { threadId, emailId, userId, tone = 'professional', customPrompt, emailContext } = options;
  const targetId = threadId || emailId;

  // 1. Fetch user accounts
  const userAccounts = await db
    .select({ id: connectedAccounts.id, email: connectedAccounts.email })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  const userAccountEmail = userAccounts[0]?.email || 'me';

  // 2. Fetch thread messages across all available strategies
  let threadMessages: Array<{
    id: string;
    threadId: string;
    sender: string;
    recipients: string;
    subject: string | null;
    bodyText: string | null;
    bodyHtml: string | null;
    receivedAt: Date | null;
  }> = [];

  if (targetId) {
    try {
      // Find candidate email or thread
      if (isValidUuid(targetId)) {
        // Direct UUID thread lookup
        threadMessages = await db
          .select({
            id: emails.id,
            threadId: emails.threadId,
            sender: emails.sender,
            recipients: emails.recipients,
            subject: emails.subject,
            bodyText: emails.bodyText,
            bodyHtml: emails.bodyHtml,
            receivedAt: emails.receivedAt,
          })
          .from(emails)
          .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
          .where(and(eq(emails.threadId, targetId), eq(connectedAccounts.userId, userId)))
          .orderBy(asc(emails.receivedAt));

        // If not found by threadId, try by email.id
        if (threadMessages.length === 0) {
          const [singleEmail] = await db
            .select({ id: emails.id, threadId: emails.threadId })
            .from(emails)
            .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
            .where(and(eq(emails.id, targetId), eq(connectedAccounts.userId, userId)))
            .limit(1);

          if (singleEmail) {
            threadMessages = await db
              .select({
                id: emails.id,
                threadId: emails.threadId,
                sender: emails.sender,
                recipients: emails.recipients,
                subject: emails.subject,
                bodyText: emails.bodyText,
                bodyHtml: emails.bodyHtml,
                receivedAt: emails.receivedAt,
              })
              .from(emails)
              .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
              .where(and(eq(emails.threadId, singleEmail.threadId), eq(connectedAccounts.userId, userId)))
              .orderBy(asc(emails.receivedAt));
          }
        }
      }

      // If still empty, search by externalThreadId or externalMessageId
      if (threadMessages.length === 0) {
        const matchingThreads = await db
          .select({
            id: emails.id,
            threadId: emails.threadId,
            sender: emails.sender,
            recipients: emails.recipients,
            subject: emails.subject,
            bodyText: emails.bodyText,
            bodyHtml: emails.bodyHtml,
            receivedAt: emails.receivedAt,
          })
          .from(emails)
          .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
          .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              or(
                eq(emailThreads.externalThreadId, targetId),
                eq(emails.externalMessageId, targetId)
              )
            )
          )
          .orderBy(asc(emails.receivedAt));

        if (matchingThreads.length > 0) {
          threadMessages = matchingThreads;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message, targetId }, 'Error during SQL thread resolution');
    }
  }

  // 3. Fallback to client-provided emailContext if threadMessages is still empty
  let conversationHistory = '';
  if (threadMessages.length > 0) {
    conversationHistory = threadMessages
      .map(
        (m, idx) =>
          `[Message ${idx + 1} of ${threadMessages.length}]\nFrom: ${m.sender}\nTo: ${m.recipients}\nDate: ${m.receivedAt?.toISOString() || 'Unknown'}\nSubject: ${m.subject || ''}\nBody:\n${(m.bodyText || m.bodyHtml || '').substring(0, 2000)}`
      )
      .join('\n\n------------------------\n\n');
  } else if (emailContext && emailContext.trim()) {
    conversationHistory = emailContext.trim();
  }

  if (!conversationHistory) {
    res.write(`data: ${JSON.stringify({ error: 'No email content or thread history found to draft a reply.' })}\n\n`);
    res.end();
    return;
  }

  const prefs = await aiRepository.getUserPreferences(userId);
  const gemini = getGeminiClient();

  if (!gemini) {
    const fallbackText = `Hi,\n\nThank you for reaching out. I have reviewed the details and will follow up shortly.\n\nBest regards,`;
    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const toneInstructions: Record<string, string> = {
    professional: 'Maintain a polite, polished, and structured executive tone.',
    concise: 'Be extremely direct and brief. Use bullet points if appropriate. Maximum 3 sentences.',
    friendly: 'Warm, collaborative, empathetic, and encouraging.',
    decline: 'Politely and clearly decline the request, offering alternative times or resources if appropriate.',
    counter_propose: 'Acknowledge the proposal and suggest a realistic counter-offer/timeline.',
  };

  const isMultiMessage = threadMessages.length > 1;
  const prompt = `You are an expert AI email assistant drafting a response on behalf of the user (${userAccountEmail}).
${isMultiMessage ? 'Analyze the entire conversation thread history below to understand the full context, previous agreements, and outstanding questions, then draft a context-aware reply to the latest message.' : 'Draft a context-aware reply to the email below.'}

Selected Tone: ${tone} (${toneInstructions[tone] || toneInstructions.professional})
User Custom Direction: "${customPrompt || 'Respond appropriately to the latest message in the thread'}"
User Style Guidelines: "${prefs?.customInstructions || 'Sound authentic, natural, and helpful'}"

Instructions:
- Output ONLY the reply email body text.
- Do NOT include Subject headers, Markdown code blocks (\`\`\`email), or introductory meta-chatter.
- Address specific details or requests raised in the latest email.
- Use a polite greeting and professional sign-off.

Email Conversation:
<conversation>
${conversationHistory}
</conversation>`;

  const candidateModels = [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS, 'gemini-3.7-flash', 'gemini-3.5-flash'];
  let streamSucceeded = false;

  for (const model of candidateModels) {
    try {
      const stream = await gemini.models.generateContentStream({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      streamSucceeded = true;
      break;
    } catch (err: any) {
      logger.warn({ model, err: err.message }, 'Streaming candidate attempt failed, trying next candidate');
    }
  }

  if (!streamSucceeded) {
    try {
      const response = await gemini.models.generateContent({
        model: PRIMARY_FLASH_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (response.text) {
        res.write(`data: ${JSON.stringify({ text: response.text })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      logger.error({ err: err.message, targetId }, 'Error generating reply draft from Gemini');
      res.write(`data: ${JSON.stringify({ error: err.message || 'Failed to generate draft' })}\n\n`);
      res.end();
    }
  }
}
