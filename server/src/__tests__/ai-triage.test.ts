import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triageEmail } from '../services/ai/features/triage.service.js';
import { setAiProvider } from '../services/ai/core/factory.js';

describe('AI Triage Service', () => {
  beforeEach(() => {
    setAiProvider({
      name: 'mock',
      isAvailable: () => true,
      generateStructuredJson: vi.fn().mockImplementation(async (opts: any) => {
        if (opts.prompt.includes('contract ASAP')) {
          return {
            priority: 'p1_urgent',
            urgencyScore: 95,
            category: 'action_required',
            oneSentenceSummary: 'Sign contract before 5 PM deadline.',
            tasks: [{ title: 'Sign contract', type: 'assigned_to_me', priority: 'high' }],
          };
        }
        return {
          priority: 'p2_important',
          urgencyScore: 70,
          category: 'direct',
          oneSentenceSummary: 'Important direct message.',
          newsletterTopic: 'Direct',
          tasks: [],
        };
      }),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn(),
    } as any);
  });

  afterEach(() => {
    setAiProvider(null);
  });

  it('should classify newsletter emails to p4_newsletter via heuristic fallback when no LLM client', async () => {
    setAiProvider({
      name: 'unavailable-mock',
      isAvailable: () => false,
      generateStructuredJson: vi.fn(),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn(),
    } as any);

    const email = {
      id: 'test-1',
      subject: 'Weekly Tech Digest #42',
      sender: 'newsletter@substack.com',
      recipients: 'user@example.com',
      bodyText: 'Here is your weekly digest of AI news. Click here to unsubscribe.',
      receivedAt: new Date(),
    };

    const result = await triageEmail(email);
    expect(result.priority).toBe('p4_newsletter');
    expect(result.category).toBe('newsletter');
    expect(typeof result.newsletterTopic).toBe('string');
  });

  it('should classify urgent action emails to p1_urgent with extracted tasks', async () => {
    const email = {
      id: 'test-2',
      subject: 'Urgent: Please review and sign contract ASAP',
      sender: 'client@company.com',
      recipients: 'user@example.com',
      bodyText: 'We need your signature before tomorrow 5 PM deadline.',
      receivedAt: new Date(),
    };

    const result = await triageEmail(email);
    expect(result.priority).toBe('p1_urgent');
    expect(result.category).toBe('action_required');
    expect(result.extractedTasks.length).toBeGreaterThan(0);
  });

  it('should elevate VIP senders to p1_urgent priority', async () => {
    const email = {
      id: 'test-3',
      subject: 'Quick question about the sprint',
      sender: 'vip.ceo@bigco.com',
      recipients: 'user@example.com',
      bodyText: 'How is the release looking?',
      receivedAt: new Date(),
    };

    const result = await triageEmail(email, {
      vipSenders: ['vip.ceo@bigco.com'],
    });

    expect(result.priority).toBe('p1_urgent');
  });

  it('should flag low confidence triage classifications for human review', async () => {
    setAiProvider({
      name: 'mock',
      isAvailable: () => true,
      generateStructuredJson: vi.fn().mockResolvedValue({
        priority: 'p2_important',
        urgencyScore: 55,
        confidenceScore: 0.52,
        category: 'direct',
        oneSentenceSummary: 'Ambiguous short message.',
        tasks: [],
      }),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateEmbedding: vi.fn(),
      chatWithTools: vi.fn(),
    } as any);

    const email = {
      id: 'test-ambiguous',
      subject: 'Fwd:',
      sender: 'someone@example.com',
      recipients: 'user@example.com',
      bodyText: 'See attached.',
      receivedAt: new Date(),
    };

    const result = await triageEmail(email);
    expect(result.confidenceScore).toBe(0.52);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('should mark high confidence classifications as not requiring human review', async () => {
    const email = {
      id: 'test-clear',
      subject: 'Urgent: Please review and sign contract ASAP',
      sender: 'client@company.com',
      recipients: 'user@example.com',
      bodyText: 'We need your signature before tomorrow 5 PM deadline.',
      receivedAt: new Date(),
    };

    const result = await triageEmail(email);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(result.requiresHumanReview).toBe(false);
  });
});
