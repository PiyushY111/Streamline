import { describe, it, expect, vi, beforeEach } from 'vitest';
import { styleProfilerService } from '../services/ai/features/style-profiler.service.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

describe('Linguistic Style Profiler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default profile when no existing record is found', async () => {
    const mockSelectChain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (db.select as any).mockReturnValue(mockSelectChain);

    const profile = await styleProfilerService.getStyleProfile('user-test-style');
    expect(profile.formality).toBe('balanced');
    expect(profile.preferredGreeting).toBe('Hi');
    expect(profile.preferredSignoff).toBe('Best');
  });

  it('should format style prompt section with authentic guidelines and few-shot examples', () => {
    const mockProfile = {
      userId: 'user-test-1',
      formality: 'casual' as const,
      brevity: 'concise' as const,
      avgSentenceLength: 12,
      preferredGreeting: 'Hey',
      preferredSignoff: 'Cheers',
      useBulletPoints: true,
      sampleSentSnippets: ['Hey team, please review the PR attached. Cheers!'],
    };

    const promptSection = styleProfilerService.formatStylePromptSection(mockProfile);
    expect(promptSection).toContain('- Formality Level: CASUAL');
    expect(promptSection).toContain('Preferred Greeting: Start with "Hey"');
    expect(promptSection).toContain('Preferred Sign-off: Conclude with "Cheers,"');
    expect(promptSection).toContain('Use short bullet points when enumerating action items');
    expect(promptSection).toContain("Example 1 from User's Sent History");
    expect(promptSection).toContain('Hey team, please review the PR attached. Cheers!');
  });
});
