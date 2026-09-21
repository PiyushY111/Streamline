import { describe, it, expect } from 'vitest';
import { getEmailCategory, detectSmartTopic } from '../categorize';
import type { EmailData } from '@/lib/api';

function makeEmail(overrides: Partial<EmailData> = {}): EmailData {
  return {
    id: 'e1',
    threadId: 't1',
    accountId: 'a1',
    accountName: 'Acc',
    accountColor: '#000',
    sender: 'someone@corp.test',
    recipients: 'me@corp.test',
    subject: 'Hello',
    snippet: 'snippet',
    receivedAt: new Date().toISOString(),
    isRead: false,
    isStarred: false,
    ...overrides,
  };
}

describe('getEmailCategory', () => {
  it('maps aiPriority p1_urgent directly', () => {
    expect(getEmailCategory(makeEmail({ aiPriority: 'p1_urgent' }))).toBe('p1_urgent');
  });

  it('maps aiPriority p5_low to p4_newsletter', () => {
    expect(getEmailCategory(makeEmail({ aiPriority: 'p5_low' }))).toBe('p4_newsletter');
  });

  it('falls back to category=promotions when no aiPriority', () => {
    expect(getEmailCategory(makeEmail({ category: 'promotions' }))).toBe('p4_newsletter');
  });

  it('falls back to category=social/updates as p3_updates', () => {
    expect(getEmailCategory(makeEmail({ category: 'social' }))).toBe('p3_updates');
    expect(getEmailCategory(makeEmail({ category: 'updates' }))).toBe('p3_updates');
  });

  it('detects newsletter senders by keyword', () => {
    expect(getEmailCategory(makeEmail({ sender: 'news@substack.com' }))).toBe('p4_newsletter');
  });

  it('detects noreply/notification senders and receipt/invoice/security subjects as updates', () => {
    expect(getEmailCategory(makeEmail({ sender: 'noreply@service.com' }))).toBe('p3_updates');
    expect(getEmailCategory(makeEmail({ subject: 'Your invoice is ready' }))).toBe('p3_updates');
  });

  it('detects urgent subject keywords as p1_urgent', () => {
    expect(getEmailCategory(makeEmail({ subject: 'URGENT: action required' }))).toBe('p1_urgent');
  });

  it('defaults to p2_important', () => {
    expect(getEmailCategory(makeEmail())).toBe('p2_important');
  });
});

describe('detectSmartTopic', () => {
  it('prefers an explicit aiNewsletterTopic', () => {
    expect(detectSmartTopic(makeEmail({ aiNewsletterTopic: 'Custom Topic' }))).toBe('Custom Topic');
  });

  it('detects academic keywords', () => {
    expect(detectSmartTopic(makeEmail({ sender: 'registrar@rishihood.edu.in' }))).toBe('🎓 Academics');
  });

  it('detects dev club keywords', () => {
    expect(detectSmartTopic(makeEmail({ subject: 'DevClub bootcamp kickoff' }))).toBe('💼 DevClub');
  });

  it('returns null when nothing matches and category is not newsletter', () => {
    expect(detectSmartTopic(makeEmail({ subject: 'Team lunch plans' }))).toBeNull();
  });
});
