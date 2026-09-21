import { describe, it, expect } from 'vitest';
import { mergeIncomingEmails } from '../mergeEmails';
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

describe('mergeIncomingEmails', () => {
  it('keeps a previously-loaded full body when the incoming refresh only has a snippet', () => {
    const prev = [makeEmail({ id: '1', bodyHtml: '<p>full</p>', bodyText: 'full' })];
    const incoming = [makeEmail({ id: '1', bodyHtml: undefined, bodyText: undefined })];
    const result = mergeIncomingEmails(prev, incoming);
    expect(result[0]!.bodyHtml).toBe('<p>full</p>');
    expect(result[0]!.bodyText).toBe('full');
  });

  it('uses the incoming body when there was nothing loaded before', () => {
    const prev = [makeEmail({ id: '1' })];
    const incoming = [makeEmail({ id: '1', bodyHtml: '<p>new</p>' })];
    const result = mergeIncomingEmails(prev, incoming);
    expect(result[0]!.bodyHtml).toBe('<p>new</p>');
  });

  it('takes other fields (e.g. isRead) from the incoming item, not the previous one', () => {
    const prev = [makeEmail({ id: '1', isRead: false })];
    const incoming = [makeEmail({ id: '1', isRead: true })];
    const result = mergeIncomingEmails(prev, incoming);
    expect(result[0]!.isRead).toBe(true);
  });

  it('passes through new emails with no previous counterpart unchanged', () => {
    const result = mergeIncomingEmails([], [makeEmail({ id: 'new' })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('new');
  });

  it('drops emails that are no longer present in the incoming list', () => {
    const prev = [makeEmail({ id: '1' }), makeEmail({ id: '2' })];
    const result = mergeIncomingEmails(prev, [makeEmail({ id: '1' })]);
    expect(result.map((e) => e.id)).toEqual(['1']);
  });
});
