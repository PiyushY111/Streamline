import { db } from '../../../db/index.js';
import { emails, connectedAccounts, userStyleProfiles } from '../../../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger.js';

export interface StyleProfile {
  id?: string;
  userId: string;
  formality: 'casual' | 'balanced' | 'formal';
  brevity: 'concise' | 'balanced' | 'detailed';
  avgSentenceLength: number;
  preferredGreeting: string;
  preferredSignoff: string;
  useBulletPoints: boolean;
  sampleSentSnippets: string[];
  traitsDescription?: string;
}

export class StyleProfilerService {
  /**
   * Retrieve active style profile for a user, or return default profile
   */
  public async getStyleProfile(userId: string): Promise<StyleProfile> {
    try {
      const [existing] = await db
        .select()
        .from(userStyleProfiles)
        .where(eq(userStyleProfiles.userId, userId))
        .limit(1);

      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          formality: existing.formality as any,
          brevity: existing.brevity as any,
          avgSentenceLength: existing.avgSentenceLength,
          preferredGreeting: existing.preferredGreeting,
          preferredSignoff: existing.preferredSignoff,
          useBulletPoints: existing.useBulletPoints,
          sampleSentSnippets: existing.sampleSentSnippets || [],
          traitsDescription: existing.traitsDescription || undefined,
        };
      }
    } catch (err: any) {
      logger.warn({ userId, err: err.message }, 'Failed to query userStyleProfiles, returning default');
    }

    return {
      userId,
      formality: 'balanced',
      brevity: 'concise',
      avgSentenceLength: 14,
      preferredGreeting: 'Hi',
      preferredSignoff: 'Best',
      useBulletPoints: false,
      sampleSentSnippets: [],
      traitsDescription: 'Polite, clear, and direct communication.',
    };
  }

  /**
   * Analyze sent emails to profile the user's authentic writing fingerprint
   */
  public async analyzeAndLearnStyleFromSentMails(userId: string): Promise<StyleProfile> {
    logger.info({ userId }, 'Analyzing sent emails for user style profiling...');

    // Fetch up to 50 sent messages across user's connected accounts
    const sentRecords = await db
      .select({
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
      })
      .from(emails)
      .innerJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          eq(emails.folder, 'sent')
        )
      )
      .orderBy(desc(emails.receivedAt))
      .limit(50);

    const bodies = sentRecords
      .map((r) => (r.bodyText || r.bodyHtml || '').replace(/<[^>]*>?/gm, ' ').trim())
      .filter((b) => b.length > 20 && b.length < 3000);

    if (bodies.length < 2) {
      logger.info({ userId, count: bodies.length }, 'Insufficient sent emails to profile, saving default profile');
      return this.getStyleProfile(userId);
    }

    // Statistical & Linguistic Analysis
    const greetingsCount: Record<string, number> = { Hi: 0, Hey: 0, Hello: 0, Dear: 0 };
    const signoffCount: Record<string, number> = { Best: 0, Thanks: 0, Cheers: 0, Regards: 0, 'Talk soon': 0 };
    let bulletPointCount = 0;
    let totalSentences = 0;
    let totalWords = 0;
    const cleanSamples: string[] = [];

    for (const body of bodies) {
      const lower = body.toLowerCase();
      // Detect greetings
      if (/^hey\b/i.test(body)) greetingsCount.Hey++;
      else if (/^hello\b/i.test(body)) greetingsCount.Hello++;
      else if (/^dear\b/i.test(body)) greetingsCount.Dear++;
      else greetingsCount.Hi++;

      // Detect sign-offs
      if (/\b(cheers|thanks|regards|talk soon|best)\b/i.test(lower)) {
        if (/cheers/i.test(lower)) signoffCount.Cheers++;
        else if (/thanks/i.test(lower)) signoffCount.Thanks++;
        else if (/talk soon/i.test(lower)) signoffCount['Talk soon']++;
        else if (/regards/i.test(lower)) signoffCount.Regards++;
        else signoffCount.Best++;
      }

      // Check bullet points
      if (/[•\-\*]\s+/m.test(body)) {
        bulletPointCount++;
      }

      // Word & sentence statistics
      const words = body.split(/\s+/).filter(Boolean);
      const sentences = body.split(/[.!?]+/).filter(Boolean);
      totalWords += words.length;
      totalSentences += Math.max(1, sentences.length);

      if (cleanSamples.length < 4 && body.length > 50 && body.length < 600) {
        cleanSamples.push(body.slice(0, 500));
      }
    }

    const avgSentenceLength = Math.round(totalWords / Math.max(1, totalSentences));
    const preferredGreeting = Object.entries(greetingsCount).sort((a, b) => b[1] - a[1])[0][0];
    const preferredSignoff = Object.entries(signoffCount).sort((a, b) => b[1] - a[1])[0][0];
    const useBulletPoints = bulletPointCount / bodies.length > 0.3;

    const avgWordsPerEmail = totalWords / bodies.length;
    const brevity: 'concise' | 'balanced' | 'detailed' =
      avgWordsPerEmail < 45 ? 'concise' : avgWordsPerEmail > 120 ? 'detailed' : 'balanced';

    const formality: 'casual' | 'balanced' | 'formal' =
      preferredGreeting === 'Hey' ? 'casual' : preferredGreeting === 'Dear' ? 'formal' : 'balanced';

    const profile: StyleProfile = {
      userId,
      formality,
      brevity,
      avgSentenceLength: Math.min(25, Math.max(8, avgSentenceLength)),
      preferredGreeting,
      preferredSignoff,
      useBulletPoints,
      sampleSentSnippets: cleanSamples,
      traitsDescription: `User communicates with a ${formality} style, averaging ${avgSentenceLength} words per sentence. Prefers greeting "${preferredGreeting}" and sign-off "${preferredSignoff}".`,
    };

    try {
      await db
        .insert(userStyleProfiles)
        .values({
          userId: profile.userId,
          formality: profile.formality,
          brevity: profile.brevity,
          avgSentenceLength: profile.avgSentenceLength,
          preferredGreeting: profile.preferredGreeting,
          preferredSignoff: profile.preferredSignoff,
          useBulletPoints: profile.useBulletPoints,
          sampleSentSnippets: profile.sampleSentSnippets,
          traitsDescription: profile.traitsDescription,
        })
        .onConflictDoUpdate({
          target: userStyleProfiles.userId,
          set: {
            formality: profile.formality,
            brevity: profile.brevity,
            avgSentenceLength: profile.avgSentenceLength,
            preferredGreeting: profile.preferredGreeting,
            preferredSignoff: profile.preferredSignoff,
            useBulletPoints: profile.useBulletPoints,
            sampleSentSnippets: profile.sampleSentSnippets,
            traitsDescription: profile.traitsDescription,
            updatedAt: sql`NOW()`,
          },
        });

      logger.info({ userId, formality, brevity, preferredSignoff }, 'Saved user style profile to database');
    } catch (err: any) {
      logger.warn({ userId, err: err.message }, 'Failed to persist style profile in DB, continuing in memory');
    }

    return profile;
  }

  /**
   * Format the style profile into an XML instruction block with few-shot sent examples
   */
  public formatStylePromptSection(profile: StyleProfile): string {
    const examplesBlock = profile.sampleSentSnippets.length > 0
      ? profile.sampleSentSnippets
          .map((sample, i) => `[Example ${i + 1} from User's Sent History]\n${sample}`)
          .join('\n\n')
      : `[Standard Example]\n${profile.preferredGreeting} Team,\n\nThanks for the update. Let's move forward with this proposal.\n\n${profile.preferredSignoff},`;

    return `
<user_personal_writing_style>
AUTHENTIC WRITING FINGERPRINT TO MIRROR:
- Formality Level: ${profile.formality.toUpperCase()}
- Tone & Brevity: ${profile.brevity.toUpperCase()} (Target ~${profile.avgSentenceLength} words per sentence)
- Preferred Greeting: Start with "${profile.preferredGreeting}" (e.g. "${profile.preferredGreeting} [Name],")
- Preferred Sign-off: Conclude with "${profile.preferredSignoff},"
- Formatting Preference: ${profile.useBulletPoints ? 'Use short bullet points when enumerating action items' : 'Write in natural concise paragraphs'}

AUTHENTIC FEW-SHOT WRITING EXAMPLES FROM USER'S SENT MAIL:
${examplesBlock}

GHOST-DRAFTING DIRECTIVE:
You are acting as an authentic ghost-writer. Match the exact tone, greetings, brevity, and sign-off patterns shown above. Never use generic corporate buzzwords.
</user_personal_writing_style>
`.trim();
  }
}

export const styleProfilerService = new StyleProfilerService();
