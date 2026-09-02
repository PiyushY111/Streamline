import { getGeminiClient, PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS, generateContentWithFallback } from './gemini.client.js';
import { Type } from '@google/genai';
import { aiRepository } from '../../repositories/ai.repository.js';

import { logger } from '../../utils/logger.js';
import { NewsletterTopicSummary, DigestActionSummary } from '../../db/schema/index.js';

export async function generateDailyDigestForUser(userId: string): Promise<any> {
  logger.info({ userId }, 'Generating Daily Executive & Newsletter Digest...');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newsletters = await aiRepository.getNewslettersForUser(userId, since);
  const urgentEmails = await aiRepository.getUrgentEmailsForUser(userId, since);
  const prefs = await aiRepository.getUserPreferences(userId);

  const gemini = getGeminiClient();

  if (!gemini || (newsletters.length === 0 && urgentEmails.length === 0)) {
    // Generate fallback structured digest
    return generateFallbackDigest(userId, newsletters, urgentEmails);
  }

  try {
    const newsletterPayload = newsletters.map((n) => ({
      emailId: n.emailId,
      subject: n.subject,
      sender: n.sender,
      topic: n.newsletterTopic || 'General',
      bodySnippet: (n.bodyText || '').substring(0, 1500),
    }));

    const urgentPayload = urgentEmails.map((u) => ({
      emailId: u.emailId,
      subject: u.subject,
      sender: u.sender,
      summary: u.oneSentenceSummary,
      tasks: u.extractedTasks,
    }));

    const prompt = `You are the executive chief of staff AI for a high-performing professional.
Synthesize the following 24-hour emails into a structured Daily Briefing.

User Preferences/Instructions:
"${prefs?.customInstructions || 'Be direct, insightful, and concise.'}"

Input Newsletters (${newsletters.length} received):
${JSON.stringify(newsletterPayload, null, 2)}

Input Urgent Action Items (${urgentEmails.length} pending):
${JSON.stringify(urgentPayload, null, 2)}

Requirements:
1. "executiveGreeting": A crisp 2-sentence morning greeting summarizing the day's posture.
2. "scheduleSummary": High-level context or readiness note.
3. "newsletterTopics": Group the newsletters into clean thematic topics (e.g. "Tech & AI", "Macro Economy & Markets", "Design & Tools").
   - For each topic, provide a punchy headline, 3-4 bullet-point takeaways, and the list of matching source emailIds.
4. "actionSummary": List of 1-3 most critical tasks extracted from urgent emails with who requested it and urgency level.`;

    const response = await generateContentWithFallback(
      gemini,
      [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS],
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveGreeting: { type: Type.STRING },
              scheduleSummary: { type: Type.STRING },
              newsletterTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sourceEmailIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
                  },
                  required: ['topic', 'headline', 'bulletPoints', 'sourceEmailIds'],
                },
              },
              actionSummary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    task: { type: Type.STRING },
                    from: { type: Type.STRING },
                    emailId: { type: Type.STRING },
                    urgency: { type: Type.STRING },
                  },
                  required: ['task', 'from', 'emailId', 'urgency'],
                },
              },
            },
            required: ['executiveGreeting', 'newsletterTopics', 'actionSummary'],
          },
        },
      }
    );


    const parsed = JSON.parse(response.text || '{}');

    const saved = await aiRepository.saveDailyDigest({
      userId,
      executiveGreeting: parsed.executiveGreeting || 'Good morning! Here is your daily productivity briefing.',
      scheduleSummary: parsed.scheduleSummary,
      newsletterTopics: parsed.newsletterTopics || [],
      actionSummary: parsed.actionSummary || [],
    });

    logger.info({ userId, digestId: saved.id }, 'Daily Digest generated and saved successfully');
    return saved;
  } catch (err: any) {
    logger.error({ err: err.message, userId }, 'Failed to generate Gemini daily digest, falling back');
    return generateFallbackDigest(userId, newsletters, urgentEmails);
  }
}

async function generateFallbackDigest(userId: string, newsletters: any[], urgentEmails: any[]) {
  const topics: NewsletterTopicSummary[] = [];

  if (newsletters.length > 0) {
    topics.push({
      topic: 'Daily Newsletters & Subscriptions',
      headline: `${newsletters.length} subscriptions received in the last 24 hours`,
      bulletPoints: newsletters.slice(0, 5).map((n) => `${n.sender}: ${n.subject || 'Newsletter'}`),
      sourceEmailIds: newsletters.map((n) => n.emailId),
      sentiment: 'neutral',
    });
  }

  const actionSummary: DigestActionSummary[] = urgentEmails.slice(0, 5).map((u) => ({
    task: u.oneSentenceSummary || u.subject || 'Review urgent message',
    from: u.sender,
    emailId: u.emailId,
    urgency: 'high',
  }));

  const saved = await aiRepository.saveDailyDigest({
    userId,
    executiveGreeting: 'Good day! Here is your synthesized executive summary of recent updates and actions.',
    scheduleSummary: 'All systems synced and up to date.',
    newsletterTopics: topics,
    actionSummary,
  });

  return saved;
}
