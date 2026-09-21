import { describe, it, expect } from 'vitest';
import { filterEmails, groupThreads, paginate, type FilterEmailsOptions } from '../filters';
import type { EmailData } from '@/lib/api';

function makeEmail(overrides: Partial<EmailData> = {}): EmailData {
  return {
    id: 'e1',
    threadId: 't1',
    accountId: 'a1',
    accountName: 'Acc',
    accountColor: '#000',
    sender: 'someone@example.com',
    recipients: 'me@example.com',
    subject: 'Hello',
    snippet: 'snippet',
    receivedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    isRead: false,
    isStarred: false,
    ...overrides,
  };
}

const baseOpts: FilterEmailsOptions = {
  selectedAccountFilter: 'all',
  selectedCustomLabelFilter: 'all',
  emailLabelsMap: {},
  activeFolder: 'inbox',
  snoozedMetaMap: {},
  activeCategory: 'all',
  searchQuery: '',
  advancedFilters: null,
};

describe('filterEmails', () => {
  it('filters by account', () => {
    const emails = [makeEmail({ id: '1', accountId: 'a' }), makeEmail({ id: '2', accountId: 'b' })];
    const result = filterEmails(emails, { ...baseOpts, selectedAccountFilter: 'a' });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('filters by custom label assignment', () => {
    const emails = [makeEmail({ id: '1' }), makeEmail({ id: '2' })];
    const result = filterEmails(emails, {
      ...baseOpts,
      selectedCustomLabelFilter: 'lbl-1',
      emailLabelsMap: { '1': ['lbl-1'] },
    });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('excludes emails outside inbox folder when activeFolder is inbox', () => {
    const emails = [makeEmail({ id: '1', folder: 'inbox' }), makeEmail({ id: '2', folder: 'trash' })];
    const result = filterEmails(emails, baseOpts);
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('starred folder only keeps starred emails', () => {
    const emails = [makeEmail({ id: '1', isStarred: true }), makeEmail({ id: '2', isStarred: false })];
    const result = filterEmails(emails, { ...baseOpts, activeFolder: 'starred' });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('snoozed folder keeps emails present in snoozedMetaMap', () => {
    const emails = [makeEmail({ id: '1' }), makeEmail({ id: '2' })];
    const result = filterEmails(emails, {
      ...baseOpts,
      activeFolder: 'snoozed',
      snoozedMetaMap: { '1': 'Tomorrow' },
    });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('filters inbox by AI category when activeCategory is set', () => {
    const emails = [makeEmail({ id: '1', aiPriority: 'p1_urgent' }), makeEmail({ id: '2', aiPriority: 'p2_important' })];
    const result = filterEmails(emails, { ...baseOpts, activeCategory: 'p1_urgent' });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('filters by search query across subject/sender/snippet', () => {
    const emails = [makeEmail({ id: '1', subject: 'Quarterly report' }), makeEmail({ id: '2', subject: 'Lunch' })];
    const result = filterEmails(emails, { ...baseOpts, searchQuery: 'quarterly' });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('applies advanced filters (from, hasAttachment)', () => {
    const emails = [
      makeEmail({ id: '1', sender: 'alex@corp.com', attachments: [{ filename: 'a.pdf' }] }),
      makeEmail({ id: '2', sender: 'jamie@corp.com' }),
    ];
    const result = filterEmails(emails, {
      ...baseOpts,
      advancedFilters: { from: 'alex', to: '', subject: '', hasAttachment: true, dateWithin: '' },
    });
    expect(result.map((e) => e.id)).toEqual(['1']);
  });
});

describe('groupThreads', () => {
  it('groups emails by threadId and counts messages', () => {
    const emails = [
      makeEmail({ id: '1', threadId: 'th1', receivedAt: '2024-01-01T00:00:00Z' }),
      makeEmail({ id: '2', threadId: 'th1', receivedAt: '2024-01-02T00:00:00Z' }),
      makeEmail({ id: '3', threadId: 'th2', receivedAt: '2024-01-01T00:00:00Z' }),
    ];
    const result = groupThreads(emails);
    expect(result).toHaveLength(2);
    const th1 = result.find((t) => t.threadId === 'th1')!;
    expect(th1.messageCount).toBe(2);
    expect(th1.id).toBe('2'); // latest message represents the thread
  });
});

describe('paginate', () => {
  it('slices items and computes page metadata', () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const result = paginate(items, 2, 5);
    expect(result.items).toEqual([5, 6, 7, 8, 9]);
    expect(result.totalCount).toBe(12);
    expect(result.totalPages).toBe(3);
    expect(result.startIndex).toBe(5);
    expect(result.endIndex).toBe(10);
  });

  it('always reports at least one page for empty input', () => {
    const result = paginate([], 1, 50);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });
});
