import { describe, it, expect, vi } from 'vitest';
import { triageEmail } from '../services/ai/triage.service.js';

describe('AI Triage Service', { timeout: 15000 }, () => {
  it('should classify newsletter emails to p4_newsletter via heuristic fallback when no LLM client', async () => {
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
});
