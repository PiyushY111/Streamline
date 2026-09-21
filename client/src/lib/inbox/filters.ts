import type { EmailData } from '@/lib/api';
import type { SearchFilterState } from '@/components/inbox/AdvancedSearchModal';
import { getEmailCategory } from './categorize';
import type { ActiveFolder } from './types';

export interface FilterEmailsOptions {
  selectedAccountFilter: string | 'all';
  selectedCustomLabelFilter: string | 'all';
  emailLabelsMap: Record<string, string[]>;
  activeFolder: ActiveFolder;
  snoozedMetaMap: Record<string, string>;
  activeCategory: string;
  searchQuery: string;
  advancedFilters: SearchFilterState | null;
}

export function filterEmails(emails: EmailData[], opts: FilterEmailsOptions): EmailData[] {
  const {
    selectedAccountFilter,
    selectedCustomLabelFilter,
    emailLabelsMap,
    activeFolder,
    snoozedMetaMap,
    activeCategory,
    searchQuery,
    advancedFilters,
  } = opts;

  return emails.filter((email) => {
    if (selectedAccountFilter !== 'all' && email.accountId !== selectedAccountFilter) {
      return false;
    }

    if (selectedCustomLabelFilter !== 'all') {
      const assigned = emailLabelsMap[email.id] || [];
      if (!assigned.includes(selectedCustomLabelFilter)) return false;
    }

    if (activeFolder === 'starred') {
      if (!email.isStarred) return false;
    } else if (activeFolder === 'sent') {
      if (email.folder !== 'sent' && !email.sender.includes('@gmail.com')) return false;
    } else if (activeFolder === 'drafts') {
      if (email.folder !== 'drafts') return false;
    } else if (activeFolder === 'trash') {
      if (email.folder !== 'trash') return false;
    } else if (activeFolder === 'snoozed') {
      if (email.folder !== 'snoozed' && !snoozedMetaMap[email.id]) return false;
    } else if (activeFolder === 'inbox') {
      if (email.folder && email.folder !== 'inbox') return false;
    }

    if (activeFolder === 'inbox' && activeCategory !== 'all') {
      const emailCat = getEmailCategory(email);
      if (emailCat !== activeCategory) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        email.subject.toLowerCase().includes(q) ||
        email.sender.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (advancedFilters) {
      if (advancedFilters.from && !email.sender.toLowerCase().includes(advancedFilters.from.toLowerCase()))
        return false;
      if (advancedFilters.to && !email.recipients.toLowerCase().includes(advancedFilters.to.toLowerCase()))
        return false;
      if (advancedFilters.subject && !email.subject.toLowerCase().includes(advancedFilters.subject.toLowerCase()))
        return false;
      if (advancedFilters.hasAttachment) {
        const hasAtt = email.attachments && email.attachments.length > 0;
        if (!hasAtt) return false;
      }
    }

    return true;
  });
}

export type EmailThreadSummary = EmailData & { messageCount: number };

/** Groups emails by threadId, keeping the most recently received message as the representative row. */
export function groupThreads(emails: EmailData[]): EmailThreadSummary[] {
  const uniqueThreadsMap = new Map<string, { latestEmail: EmailData; messageCount: number }>();

  emails.forEach((email) => {
    const existing = uniqueThreadsMap.get(email.threadId);
    if (!existing) {
      uniqueThreadsMap.set(email.threadId, { latestEmail: email, messageCount: 1 });
    } else {
      existing.messageCount++;
      if (new Date(email.receivedAt).getTime() > new Date(existing.latestEmail.receivedAt).getTime()) {
        existing.latestEmail = email;
      }
    }
  });

  return Array.from(uniqueThreadsMap.values()).map((t) => ({ ...t.latestEmail, messageCount: t.messageCount }));
}

export interface PaginationResult<T> {
  totalCount: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  items: T[];
}

export function paginate<T>(items: T[], currentPage: number, itemsPerPage: number): PaginationResult<T> {
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  return { totalCount, totalPages, startIndex, endIndex, items: items.slice(startIndex, endIndex) };
}
