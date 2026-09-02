import { Request, Response } from 'express';
import { aiRepository } from '../repositories/ai.repository.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { generateDailyDigestForUser } from '../services/ai/newsletter-digest.service.js';
import { streamDraftReply } from '../services/ai/reply-drafter.service.js';
import { triageEmail } from '../services/ai/triage.service.js';
import { getGeminiClient, PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from '../services/ai/gemini.client.js';
import { emails, emailThreads, connectedAccounts } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { Type } from '@google/genai';
import { aiCostGuardService } from '../services/ai/cost-guard.service.js';



function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId || '';
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
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
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to get AI preferences');
    res.status(500).json({ error: 'Failed to retrieve AI preferences' });
  }
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const updated = await aiRepository.upsertUserPreferences(userId, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to update AI preferences');
    res.status(500).json({ error: 'Failed to update AI preferences' });
  }
}

export async function getRadarTasks(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const radarTasks = await aiRepository.getRadarTasks(userId);
    res.status(200).json({ success: true, count: radarTasks.length, data: radarTasks });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to get AI task radar');
    res.status(500).json({ error: 'Failed to retrieve AI task radar' });
  }
}

export async function convertRadarTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
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
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to convert radar task');
    res.status(500).json({ error: 'Failed to convert radar task to official task' });
  }
}

export async function dismissRadarTask(req: Request, res: Response): Promise<void> {
  try {
    const { emailId, taskId } = req.body;
    await aiRepository.updateRadarTaskStatus(emailId, taskId, { isDismissed: true });
    res.status(200).json({ success: true, message: 'Task dismissed from radar' });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to dismiss radar task');
    res.status(500).json({ error: 'Failed to dismiss radar task' });
  }
}

export async function getDailyDigest(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    let digest = await aiRepository.getLatestDigest(userId);

    // If no digest exists at all, generate one immediately
    if (!digest) {
      digest = await generateDailyDigestForUser(userId);
    }

    res.status(200).json({ success: true, data: digest });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to get daily digest');
    res.status(500).json({ error: 'Failed to retrieve daily digest' });
  }
}

export async function triggerDigestNow(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const digest = await generateDailyDigestForUser(userId);
    res.status(200).json({ success: true, data: digest });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to trigger immediate daily digest');
    res.status(500).json({ error: 'Failed to generate daily digest' });
  }
}

export async function listDailyDigests(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const digests = await aiRepository.listUserDigests(userId, limit);
    res.status(200).json({ success: true, data: digests });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to list daily digests');
    res.status(500).json({ error: 'Failed to list daily digests' });
  }
}

export async function draftReply(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const { threadId, emailId, tone, customPrompt, emailContext, replyType } = req.body;

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
      res
    );
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to stream reply draft');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream draft reply' });
    }
  }
}

export async function summarizeThread(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
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
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const gemini = getGeminiClient();
    if (!gemini) {
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

    const candidateModels = [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS, 'gemini-3.7-flash', 'gemini-3.5-flash'];
    let summaryResult = null;

    for (const model of candidateModels) {
      try {
        const response = await gemini.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['summary', 'keyTakeaways', 'actionItems'],
            },
          },
        });

        if (response.text) {
          summaryResult = JSON.parse(response.text);
          break;
        }
      } catch (err: any) {
        logger.warn({ model, err: err.message }, 'Summarize model attempt failed, trying next candidate');
      }
    }

    if (!summaryResult) {
      summaryResult = {
        summary: `Conversation between ${threadMessages[0].sender} and participants regarding ${threadMessages[0].subject}.`,
        keyTakeaways: ['Review message details'],
        actionItems: [],
      };
    }

    res.status(200).json({ success: true, data: summaryResult });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to summarize thread');
    res.status(500).json({ error: 'Failed to summarize thread' });
  }
}

export async function triggerAutoLabelAll(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
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
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to run batch AI email labeling');
    res.status(500).json({ error: 'Failed to run AI email labeling' });
  }
}

export async function labelSingleEmail(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
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
      res.status(404).json({ error: 'Email not found' });
      return;
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
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to label single email');
    res.status(500).json({ error: 'Failed to label email with Gemini' });
  }
}

export async function getTokenUsageStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const stats = await aiCostGuardService.getUserUsageStats(userId);
    res.status(200).json({ success: true, data: stats });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to get AI token usage stats');
    res.status(500).json({ error: 'Failed to retrieve AI token usage stats' });
  }
}


