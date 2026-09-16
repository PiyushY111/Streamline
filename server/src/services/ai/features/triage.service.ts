import { getAiProvider } from '../core/factory.js';
import { PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from '../core/gemini.client.js';
import { Type } from '@google/genai';
import { logger } from '../../../utils/logger.js';
import { ExtractedTaskItem } from '../../../db/schema/index.js';
import { aiCostGuardService } from '../core/cost-guard.service.js';
import crypto from 'crypto';
import { toError } from '../../../utils/errors.js';

export interface TriageResult {
  priority: 'p1_urgent' | 'p2_important' | 'p3_updates' | 'p4_newsletter' | 'p5_low';
  urgencyScore: number;
  category: 'action_required' | 'direct' | 'notification' | 'newsletter' | 'promotional';
  oneSentenceSummary: string;
  newsletterTopic?: string;
  sentiment?: 'urgent' | 'positive' | 'neutral' | 'tense';
  extractedTasks: ExtractedTaskItem[];
}

export async function triageEmail(
  email: {
    id: string;
    subject: string | null;
    sender: string;
    recipients: string;
    bodyText: string | null;
    receivedAt: Date;
    attachments?: any;
  },
  options?: {
    userId?: string;
    vipSenders?: string[];
    userEmail?: string;
  }
): Promise<TriageResult> {
  const senderLower = email.sender.toLowerCase();
  const isVip = (options?.vipSenders || []).some((vip) => senderLower.includes(vip.toLowerCase()));

  // If userId provided, verify AI Circuit Breaker budget
  if (options?.userId) {
    const circuit = await aiCostGuardService.checkCircuitBreaker(options.userId);
    if (circuit.isTripped) {
      logger.warn({ userId: options.userId, reason: circuit.reason }, 'AI Circuit Breaker tripped, using heuristic triage');
      return heuristicFallbackTriage(email, isVip);
    }
  }

  const aiProvider = getAiProvider();

  // If AI Provider is not available, provide heuristic fallback
  if (!aiProvider.isAvailable()) {
    return heuristicFallbackTriage(email, isVip);
  }

  try {
    const prompt = `You are the executive AI triage engine of a Personal Productivity OS.
Analyze the following email and return a structured JSON response.

Context:
- User's account email: "${options?.userEmail || 'User'}"
- Is sender VIP: ${isVip}

Rules for Classification:
- Priority:
  * "p1_urgent": Direct urgent requests to the user, contracts needing signature, client blockers, explicit tasks due soon.
  * "p2_important": Direct human communication, meetings discussion, important 1-on-1 conversations.
  * "p3_updates": Automated system notifications, shipping tracking, receipts, GitHub/billing notifications.
  * "p4_newsletter": Curated newsletters, Substack, blog digests, industry roundups, news summaries.
  * "p5_low": Marketing spam, promotional discounts, cold sales pitches.
- Category: "action_required" | "direct" | "notification" | "newsletter" | "promotional"
- UrgencyScore: Integer 1 to 100 (100 = critical/immediate action, 1 = low).
- NewsletterTopic / Smart Tag: Short 2-3 word smart topic tag (e.g. "🎓 Academics", "💼 DevClub / Career", "🚀 Tech & AI", "💳 Finance", "⚠️ Urgent", "📰 Newsletter", "👥 Community").
- OneSentenceSummary: A concise 1-sentence TL;DR of the core message or request.
- Tasks: Extract concrete action items. Directional types:
  * "assigned_to_me": Request made to the user.
  * "commitment_i_made": If this is a sent email where user promised something.
  * "followup_waiting_on": If user is waiting on someone else's deliverable.


Email to analyze:
<email>
Sender: ${email.sender}
Recipients: ${email.recipients}
Subject: ${email.subject || 'No Subject'}
Date: ${email.receivedAt.toISOString()}
Body:
${(email.bodyText || '').substring(0, 4000)}
</email>`;

    const parsed: any = await aiProvider.generateStructuredJson({
      prompt,
      models: [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS],
      schema: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            enum: ['p1_urgent', 'p2_important', 'p3_updates', 'p4_newsletter', 'p5_low'],
          },
          urgencyScore: { type: Type.INTEGER },
          category: {
            type: Type.STRING,
            enum: ['action_required', 'direct', 'notification', 'newsletter', 'promotional'],
          },
          oneSentenceSummary: { type: Type.STRING },
          newsletterTopic: { type: Type.STRING },
          sentiment: {
            type: Type.STRING,
            enum: ['urgent', 'positive', 'neutral', 'tense'],
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  enum: ['assigned_to_me', 'commitment_i_made', 'followup_waiting_on'],
                },
                priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                dueDate: { type: Type.STRING },
                assignorOrAssignee: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ['title', 'type'],
            },
          },
        },
        required: ['priority', 'urgencyScore', 'category', 'oneSentenceSummary', 'tasks'],
      },
    });

    let priority = parsed.priority as TriageResult['priority'];
    if (isVip && (priority === 'p2_important' || priority === 'p3_updates')) {
      priority = 'p1_urgent';
    }

    const tasks: ExtractedTaskItem[] = (parsed.tasks || []).map((t: any) => ({
      id: crypto.randomUUID(),
      title: t.title,
      type: t.type || 'assigned_to_me',
      priority: t.priority || 'medium',
      dueDate: t.dueDate,
      assignorOrAssignee: t.assignorOrAssignee || email.sender,
      confidence: typeof t.confidence === 'number' ? t.confidence : 0.9,
      isConverted: false,
      isDismissed: false,
    }));

    // Record token usage asynchronously
    if (options?.userId && parsed) {
      const parsedText = JSON.stringify(parsed);
      const promptTokens = aiCostGuardService.estimateTokens(prompt);
      const completionTokens = aiCostGuardService.estimateTokens(parsedText);
      aiCostGuardService.recordUsage({
        userId: options.userId,
        model: PRIMARY_FLASH_MODEL,
        operation: 'triage',
        promptTokens,
        completionTokens,
      });
    }

    return {
      priority: priority || 'p2_important',
      urgencyScore: Math.min(100, Math.max(1, parsed.urgencyScore || 50)),
      category: parsed.category || 'direct',
      oneSentenceSummary: parsed.oneSentenceSummary || email.subject || 'Email conversation',
      newsletterTopic: parsed.newsletterTopic,
      sentiment: parsed.sentiment || 'neutral',
      extractedTasks: tasks,
    };
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.warn({ err: err.message, emailId: email.id }, 'Gemini triage failed, falling back to heuristic');
    return heuristicFallbackTriage(email, isVip);
  }
}

function heuristicFallbackTriage(email: any, isVip: boolean): TriageResult {
  const subject = (email.subject || '').toLowerCase();
  const sender = (email.sender || '').toLowerCase();
  const body = (email.bodyText || '').toLowerCase();

  const isNewsletter =
    sender.includes('newsletter') ||
    sender.includes('substack') ||
    sender.includes('medium') ||
    sender.includes('digest') ||
    sender.includes('daily') ||
    body.includes('unsubscribe') ||
    body.includes('view in browser');

  const isUpdate =
    sender.includes('noreply') ||
    sender.includes('no-reply') ||
    sender.includes('notifications@') ||
    sender.includes('alert') ||
    sender.includes('github') ||
    sender.includes('stripe') ||
    subject.includes('receipt') ||
    subject.includes('invoice') ||
    subject.includes('tracking') ||
    subject.includes('order confirmation');

  const isUrgent =
    isVip ||
    subject.includes('urgent') ||
    subject.includes('asap') ||
    subject.includes('action required') ||
    body.includes('please confirm') ||
    body.includes('deadline');

  let priority: TriageResult['priority'] = 'p2_important';
  let category: TriageResult['category'] = 'direct';
  let urgencyScore = 50;

  if (isUrgent) {
    priority = 'p1_urgent';
    category = 'action_required';
    urgencyScore = 85;
  } else if (isNewsletter) {
    priority = 'p4_newsletter';
    category = 'newsletter';
    urgencyScore = 20;
  } else if (isUpdate) {
    priority = 'p3_updates';
    category = 'notification';
    urgencyScore = 30;
  }

  return {
    priority,
    urgencyScore,
    category,
    oneSentenceSummary: email.subject || 'Message from ' + email.sender,
    newsletterTopic: isNewsletter ? 'General' : undefined,
    sentiment: isUrgent ? 'urgent' : 'neutral',
    extractedTasks: isUrgent
      ? [
          {
            id: crypto.randomUUID(),
            title: `Respond to: ${email.subject || 'email'}`,
            type: 'assigned_to_me',
            priority: 'high',
            confidence: 0.75,
            isConverted: false,
            isDismissed: false,
          },
        ]
      : [],
  };
}
