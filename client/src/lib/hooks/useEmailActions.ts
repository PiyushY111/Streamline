'use client';

import { useState } from 'react';
import {
  markEmailAsReadApi,
  toggleStarEmailApi,
  deleteEmailApi,
  updateEmailCategoryApi,
  fetchEmailByIdApi,
  EmailData,
} from '@/lib/api';
import { safeFetch } from '@/lib/api/client';
import type { EmailThreadSummary } from '@/lib/inbox/filters';
import type { MoveToCategory } from '@/lib/inbox/types';

export interface UseEmailActionsOptions {
  emails: EmailData[];
  setEmails: (updater: EmailData[] | ((prev: EmailData[]) => EmailData[])) => void;
  paginatedEmails: EmailThreadSummary[];
  selectedEmailId: string | null;
  setSelectedEmailId: (id: string | null) => void;
  setIsReadingThread: (value: boolean) => void;
  setIsAiDraftModalOpen: (value: boolean) => void;
  selectedEmailIds: string[];
  setSelectedEmailIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  snoozeTargetEmailId: string | null;
  setSnoozedMetaMap: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  loadData: (forceSync?: boolean) => Promise<void>;
}

/** Bulk/single email mutations (select, star, delete, snooze, category, AI labeling) and thread navigation. */
export function useEmailActions({
  emails,
  setEmails,
  paginatedEmails,
  selectedEmailId,
  setSelectedEmailId,
  setIsReadingThread,
  setIsAiDraftModalOpen,
  selectedEmailIds,
  setSelectedEmailIds,
  snoozeTargetEmailId,
  setSnoozedMetaMap,
  loadData,
}: UseEmailActionsOptions) {
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);

  const toggleSelectAll = () => {
    if (selectedEmailIds.length === paginatedEmails.length && paginatedEmails.length > 0) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(paginatedEmails.map((e) => e.id));
    }
  };

  const toggleSelectEmail = (id: string) => {
    setSelectedEmailIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBackToList = () => {
    setIsReadingThread(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.pushState({}, '', url.pathname + url.search);
    }
  };

  const handleCategoryShift = async (emailId: string, newCategory: MoveToCategory) => {
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, category: newCategory } : e)));
    try {
      await updateEmailCategoryApi(emailId, newCategory);
    } catch (err) {
      console.warn('Failed to shift email category:', err);
    }
  };

  const handleAutoLabelAll = async () => {
    setIsAutoLabeling(true);
    try {
      const res = await safeFetch('/ai/triage/all', { method: 'POST' });
      if (res.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.warn('Auto-labeling error:', err);
    } finally {
      setIsAutoLabeling(false);
    }
  };

  const handleLabelSingleEmail = async (emailId: string) => {
    try {
      const res = await safeFetch(`/ai/emails/${emailId}/triage`, { method: 'POST' });
      if (res.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.warn('Single email label error:', err);
    }
  };

  const handleSelectEmail = async (email: EmailData) => {
    setSelectedEmailId(email.id);
    setIsReadingThread(true);
    setIsAiDraftModalOpen(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('id', email.id);
      window.history.pushState({}, '', url.pathname + url.search);
    }

    if (!email.isRead) {
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e)));
      markEmailAsReadApi(email.id, true).catch((err) => {
        console.warn('Failed to mark email as read:', err);
      });
    }

    // Immediately fetch full HTML content for the selected email
    try {
      const full = await fetchEmailByIdApi(email.id);
      if (full) {
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, ...full } : e)));
      }
    } catch (err) {
      console.warn('Failed to fetch full email body:', err);
    }
  };

  const handleToggleStar = (emailId: string) => {
    const target = emails.find((e) => e.id === emailId);
    const nextStarred = target ? !target.isStarred : true;
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, isStarred: nextStarred } : e)));
    toggleStarEmailApi(emailId, nextStarred).catch((err) => {
      console.warn('Failed to star email:', err);
    });
  };

  const handleDeleteEmail = (emailId: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
      handleBackToList();
    }
    deleteEmailApi(emailId).catch((err) => {
      console.warn('Failed to delete email:', err);
    });
  };

  const handleSnoozeEmail = (_snoozeDate: Date, label: string) => {
    if (!snoozeTargetEmailId) return;
    setEmails((prev) => prev.map((e) => (e.id === snoozeTargetEmailId ? { ...e, folder: 'snoozed' } : e)));
    setSnoozedMetaMap((prev) => ({ ...prev, [snoozeTargetEmailId]: label }));
  };

  const handleBulkDelete = () => {
    if (selectedEmailIds.length === 0) return;
    setEmails((prev) => prev.filter((e) => !selectedEmailIds.includes(e.id)));
    if (selectedEmailId && selectedEmailIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
      handleBackToList();
    }
    selectedEmailIds.forEach((id) => {
      fetch(`/api/emails/${id}`, { method: 'DELETE' }).catch(() => {});
    });
    setSelectedEmailIds([]);
  };

  const handleBulkMarkRead = () => {
    if (selectedEmailIds.length === 0) return;
    setEmails((prev) => prev.map((e) => (selectedEmailIds.includes(e.id) ? { ...e, isRead: true } : e)));
    selectedEmailIds.forEach((id) => {
      fetch(`/api/emails/${id}/read`, { method: 'PATCH' }).catch(() => {});
    });
    setSelectedEmailIds([]);
  };

  return {
    isAutoLabeling,
    toggleSelectAll,
    toggleSelectEmail,
    handleBackToList,
    handleCategoryShift,
    handleAutoLabelAll,
    handleLabelSingleEmail,
    handleSelectEmail,
    handleToggleStar,
    handleDeleteEmail,
    handleSnoozeEmail,
    handleBulkDelete,
    handleBulkMarkRead,
  };
}
