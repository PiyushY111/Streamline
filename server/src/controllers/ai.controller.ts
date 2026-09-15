import { Request, Response } from 'express';
import { aiRepository } from '../repositories/ai.repository.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { generateDailyDigestForUser } from '../services/ai/features/newsletter-digest.service.js';
import { streamDraftReply } from '../services/ai/features/reply-drafter.service.js';
import { triageEmail } from '../services/ai/features/triage.service.js';
import { getAiProvider } from '../services/ai/core/factory.js';
import { PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from '../services/ai/core/gemini.client.js';
import { emails, connectedAccounts } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { Type } from '@google/genai';
import { aiCostGuardService } from '../services/ai/core/cost-guard.service.js';
import { UnauthorizedError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

function getUserId(req: Request): string {
  const id = (req as any).user?.id || (req as any).user?.userId || '';
  return id;
}

export const getPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  let prefs = await aiRepository.getUserPreferences(userId);

  if (!prefs) {
    prefs = await aiRepository.upsertUserPreferences(userId, {
      digestTime: '08:00:00',
      digestTimezone: 'UTC',
      digestDeliveryMode: 'in_app',
      isAutoTriageEnabled: true,
      vipSenders: [],
    });
  }

  res.status(200).json({ success: true, data: prefs });
});

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const updated = await aiRepository.upsertUserPreferences(userId, req.body);
  res.status(200).json({ success: true, data: updated });
});

export const getRadarTasks = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const radarTasks = await aiRepository.getRadarTasks(userId);
  res.status(200).json({ success: true, count: radarTasks.length, data: radarTasks });
});

export const convertRadarTask = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const { emailId, taskId, title, priority, dueDate } = req.body;

  // 1. Create native Task in Streamline tasks table
  const newTask = await tasksRepository.create({
    userId,
    title,
    priority: priority || 'medium',
    dueAt: dueDate ? new Date(dueDate) : undefined,
  });

  // 2. Mark task as converted in AI metadata
  await aiRepository.updateRadarTaskStatus(emailId, taskId, { isConverted: true });

  res.status(201).json({
    success: true,
    message: 'Task created successfully from AI radar',
    data: newTask,
  });
});

export const dismissRadarTask = asyncHandler(async (req: Request, res: Response) => {
  const { emailId, taskId } = req.body;
  await aiRepository.updateRadarTaskStatus(emailId, taskId, { isDismissed: true });
  res.status(200).json({ success: true, message: 'Task dismissed from radar' });
});

export const getDailyDigest = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  let digest = await aiRepository.getLatestDigest(userId);

  // If no digest exists at all, generate one immediately
  if (!digest) {
    digest = await generateDailyDigestForUser(userId);
  }

  res.status(200).json({ success: true, data: digest });
});

export const triggerDigestNow = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const digest = await generateDailyDigestForUser(userId);
  res.status(200).json({ success: true, data: digest });
});

export const listDailyDigests = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  const digests = await aiRepository.listUserDigests(userId, limit);
  res.status(200).json({ success: true, data: digests });
});

export const draftReply = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const { threadId, emailId, tone, customPrompt, emailContext, replyType } = req.body;

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  await streamDraftReply(
    {
      threadId,
      emailId,
      userId,
      tone,
      customPrompt,
      emailContext,
      replyType,
    },
    res,
    abortController.signal
  );
});

export const summarizeThread = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const threadId = String(req.params.threadId);

  const threadMessages = await db
    .select({
      id: emails.id,
      sender: emails.sender,
      recipients: emails.recipients,
      subject: emails.subject,
      bodyText: emails.bodyText,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
    .where(and(eq(emails.threadId, threadId), eq(connectedAccounts.userId, userId)))
    .orderBy(asc(emails.receivedAt));

  if (threadMessages.length === 0) {
    throw new NotFoundError('Thread not found');
  }

  const aiProvider = getAiProvider();
  if (!aiProvider.isAvailable()) {
    res.status(200).json({
      success: true,
      data: {
        summary: `${threadMessages.length} messages in conversation about: ${threadMessages[0].subject}`,
        keyTakeaways: ['Conversation active', 'Review latest reply'],
        actionItems: [],
      },
    });
    return;
  }

  const conversationText = threadMessages
    .map((m) => `From: ${m.sender}\nDate: ${m.receivedAt?.toISOString()}\nBody: ${m.bodyText}`)
    .join('\n\n---\n\n');

  const prompt = `You are an AI Executive Assistant. Summarize this email thread concisely.
Return structured summary with key takeaways and action items.

Email Thread:
${conversationText}`;

  let summaryResult = null;
  try {
    summaryResult = await aiProvider.generateStructuredJson({
      prompt,
      models: [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS, 'gemini-3.7-flash', 'gemini-3.5-flash'],
      schema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['summary', 'keyTakeaways', 'actionItems'],
      },
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'AI thread summarize attempt failed, using fallback');
  }

  if (!summaryResult) {
    summaryResult = {
      summary: `Conversation between ${threadMessages[0].sender} and participants regarding ${threadMessages[0].subject}.`,
      keyTakeaways: ['Review message details'],
      actionItems: [],
    };
  }

  res.status(200).json({ success: true, data: summaryResult });
});

export const triggerAutoLabelAll = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const userAccounts = await db
    .select({ id: connectedAccounts.id, email: connectedAccounts.email })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, userId));

  if (userAccounts.length === 0) {
    res.status(200).json({ success: true, count: 0, message: 'No connected accounts found' });
    return;
  }

  const accountIds = userAccounts.map((a) => a.id);
  const userEmails = await db
    .select({
      id: emails.id,
      threadId: emails.threadId,
      subject: emails.subject,
      sender: emails.sender,
      recipients: emails.recipients,
      bodyText: emails.bodyText,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .where(inArray(emails.accountId, accountIds))
    .orderBy(desc(emails.receivedAt))
    .limit(60);

  const prefs = await aiRepository.getUserPreferences(userId);
  let labeledCount = 0;

  // Run parallel batches with Gemini flash-lite
  const batchSize = 6;
  for (let i = 0; i < userEmails.length; i += batchSize) {
    const chunk = userEmails.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (em) => {
        try {
          const result = await triageEmail(em, {
            vipSenders: prefs?.vipSenders || [],
            userEmail: userAccounts[0]?.email,
          });
          await aiRepository.saveEmailAiMetadata({
            emailId: em.id,
            threadId: em.threadId,
            priority: result.priority,
            urgencyScore: result.urgencyScore,
            category: result.category,
            oneSentenceSummary: result.oneSentenceSummary,
            newsletterTopic: result.newsletterTopic,
            sentiment: result.sentiment,
            extractedTasks: result.extractedTasks,
          });
          labeledCount++;
        } catch (err: any) {
          logger.warn({ emailId: em.id, err: err.message }, 'Individual email triage failed');
        }
      })
    );
  }

  res.status(200).json({
    success: true,
    count: labeledCount,
    message: `Successfully classified and labeled ${labeledCount} emails with Gemini AI`,
  });
});

export const labelSingleEmail = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const emailId = String(req.params.emailId);

  const [targetEmail] = await db
    .select({
      id: emails.id,
      threadId: emails.threadId,
      subject: emails.subject,
      sender: emails.sender,
      recipients: emails.recipients,
      bodyText: emails.bodyText,
      receivedAt: emails.receivedAt,
      accountId: emails.accountId,
    })
    .from(emails)
    .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
    .where(and(eq(emails.id, emailId), eq(connectedAccounts.userId, userId)))
    .limit(1);

  if (!targetEmail) {
    throw new NotFoundError('Email not found');
  }

  const prefs = await aiRepository.getUserPreferences(userId);
  const result = await triageEmail(targetEmail, {
    vipSenders: prefs?.vipSenders || [],
  });

  const saved = await aiRepository.saveEmailAiMetadata({
    emailId: targetEmail.id,
    threadId: targetEmail.threadId,
    priority: result.priority,
    urgencyScore: result.urgencyScore,
    category: result.category,
    oneSentenceSummary: result.oneSentenceSummary,
    newsletterTopic: result.newsletterTopic,
    sentiment: result.sentiment,
    extractedTasks: result.extractedTasks,
  });

  res.status(200).json({ success: true, data: saved });
});

export const getTokenUsageStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    throw new UnauthorizedError();
  }
  const stats = await aiCostGuardService.getUserUsageStats(userId);
  res.status(200).json({ success: true, data: stats });
});
