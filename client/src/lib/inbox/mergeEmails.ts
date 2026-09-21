import type { EmailData } from '@/lib/api';

/**
 * Merges freshly-fetched emails into the existing list, preserving any full
 * body/attachment content we already fetched for a message (list endpoints
 * only return snippets, so a naive replace would drop previously-loaded
 * bodies while a thread is open).
 */
export function mergeIncomingEmails(prev: EmailData[], incoming: EmailData[]): EmailData[] {
  const prevMap = new Map(prev.map((e) => [e.id, e]));
  return incoming.map((item) => {
    const existing = prevMap.get(item.id);
    if (existing) {
      return {
        ...item,
        bodyHtml: existing.bodyHtml || item.bodyHtml,
        bodyText: existing.bodyText || item.bodyText,
        attachments: existing.attachments || item.attachments,
      };
    }
    return item;
  });
}
