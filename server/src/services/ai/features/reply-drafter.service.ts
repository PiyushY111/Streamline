import { getAiProvider } from '../core/factory.js';
import { PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from '../core/gemini.client.js';
import { db } from '../../../db/index.js';
import { emails, emailThreads, connectedAccounts } from '../../../db/schema/index.js';
import { eq, and, asc, desc, or } from 'drizzle-orm';
import { logger } from '../../../utils/logger.js';
import { aiRepository } from '../../../repositories/ai.repository.js';
import { aiCostGuardService } from '../core/cost-guard.service.js';
import { styleProfilerService } from './style-profiler.service.js';
import { Response } from 'express';
import { toError } from '../../../utils/errors.js';

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

export async function streamDraftReply(
  options: DraftOptions,
  res: Response,
  abortSignal?: AbortSignal
): Promise<void> {
  const { threadId, emailId, userId, tone = 'professional', customPrompt, emailContext } = options;
  const targetId = threadId || emailId;

  // 1. Fetch user accounts
  const userAccounts = await db
    .select({ id: connectedAccounts.id, email: connectedAccounts.email })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  const userAccountEmail = userAccounts[0]?.email || 'me';

  // 2. Fetch thread messages across all available strategies with strict multi-tenant boundary
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
      if (isValidUuid(targetId)) {
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
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              or(eq(emails.threadId, targetId), eq(emails.id, targetId))
            )
          )
          .orderBy(asc(emails.receivedAt));
      }

      if (threadMessages.length === 0) {
        const matchingEmails = await db
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
          .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
          .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
          .where(
            and(
              eq(connectedAccounts.userId, userId),
              or(eq(emails.externalMessageId, targetId), eq(emailThreads.externalThreadId, targetId))
            )
          )
          .orderBy(asc(emails.receivedAt));

        if (matchingEmails.length > 0) {
          const actualThreadId = matchingEmails[0].threadId;
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
            .where(
              and(
                eq(connectedAccounts.userId, userId),
                eq(emails.threadId, actualThreadId)
              )
            )
            .orderBy(asc(emails.receivedAt));
        }
      }
    } catch (err: unknown) {
      logger.warn({ err: toError(err).message, targetId }, 'Error during SQL thread resolution');
    }
  }


  // 3. Fallback: Context text from client if DB records empty
  let conversationHistory = '';
  if (threadMessages.length > 0) {
    conversationHistory = threadMessages
      .map((msg, index) => {
        const dateStr = msg.receivedAt ? msg.receivedAt.toISOString() : 'Unknown date';
        const cleanBody = (msg.bodyText || msg.bodyHtml || '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1500);

        return `[Message ${index + 1} | Date: ${dateStr}]
From: ${msg.sender}
To: ${msg.recipients}
Subject: ${msg.subject || 'No Subject'}
Content:
${cleanBody}`;
      })
      .join('\n\n---\n\n');
  } else if (emailContext && emailContext.trim().length > 0) {
    conversationHistory = `Context provided by user:\n${emailContext.trim().slice(0, 3000)}`;
  }

  if (!conversationHistory) {
    res.write(`data: ${JSON.stringify({ error: 'No email content or thread history found to draft a reply.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // 4. Circuit Breaker Check
  const circuit = await aiCostGuardService.checkCircuitBreaker(userId);
  if (circuit.isTripped) {
    logger.warn({ userId, reason: circuit.reason }, 'AI Circuit Breaker tripped for reply drafter');
    const fallbackText = `Hi,\n\nThank you for your message. I have received your email and will get back to you shortly.\n\nBest regards,`;
    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const prefs = await aiRepository.getUserPreferences(userId);
  const styleProfile = await styleProfilerService.getStyleProfile(userId);
  const styleInstructionBlock = styleProfilerService.formatStylePromptSection(styleProfile);
  const aiProvider = getAiProvider();

  if (!aiProvider.isAvailable()) {
    const fallbackGreeting = styleProfile.preferredGreeting || 'Hi';
    const fallbackSignoff = styleProfile.preferredSignoff || 'Best';
    const fallbackText = `${fallbackGreeting},\n\nThank you for reaching out. I have reviewed the details and will follow up shortly.\n\n${fallbackSignoff},`;
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
  const prompt = `You are an expert AI email ghost-writer drafting a context-aware response on behalf of the user (${userAccountEmail}).
${isMultiMessage ? 'Analyze the entire conversation thread history below to understand the full context, previous agreements, and outstanding questions, then draft a context-aware reply to the latest message.' : 'Draft a context-aware reply to the email below.'}

${styleInstructionBlock}

Selected Tone: ${tone} (${toneInstructions[tone] || toneInstructions.professional})
User Custom Direction: "${customPrompt || 'Respond appropriately to the latest message in the thread'}"
User Style Guidelines: "${prefs?.customInstructions || 'Sound authentic, natural, and helpful'}"

Instructions:
- Output ONLY the reply email body text.
- Do NOT include Subject headers, Markdown code blocks (\`\`\`email), or introductory meta-chatter.
- Address specific details or requests raised in the latest email.
- Mirror the user's authentic greeting, brevity, and sign-off patterns from the style profile above.

Email Conversation:
<conversation>
${conversationHistory}
</conversation>`;

  const candidateModels = [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS, 'gemini-3.7-flash', 'gemini-3.5-flash'];
  let streamSucceeded = false;
  let fullGeneratedDraft = '';

  try {
    fullGeneratedDraft = await aiProvider.streamText(
      {
        prompt,
        models: candidateModels,
      },
      (chunk) => {
        if (abortSignal?.aborted || res.writableEnded) {
          return;
        }
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    );

    if (!abortSignal?.aborted && !res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
      streamSucceeded = true;
    }
  } catch (err: unknown) {
    const error = toError(err);
    if (abortSignal?.aborted) {
      logger.info({ userId }, 'Draft reply streaming aborted by client disconnect');
      return;
    }
    logger.error({ err: error.message, targetId }, 'Error streaming reply draft');
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to generate draft' })}\n\n`);
      res.end();
    }
  }


  // 5. Asynchronously Record Token Usage
  if (streamSucceeded && fullGeneratedDraft) {
    const promptTokens = aiCostGuardService.estimateTokens(prompt);
    const completionTokens = aiCostGuardService.estimateTokens(fullGeneratedDraft);
    aiCostGuardService.recordUsage({
      userId,
      model: aiProvider.name === 'gemini' ? PRIMARY_FLASH_MODEL : aiProvider.name,
      operation: 'reply_draft',
      promptTokens,
      completionTokens,
    });
  }
}
