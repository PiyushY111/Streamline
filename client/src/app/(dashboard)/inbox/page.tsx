'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';
import { Undo2 } from 'lucide-react';

import {
  markEmailAsReadApi,
  toggleStarEmailApi,
  deleteEmailApi,
  updateEmailCategoryApi,
  fetchEmailByIdApi,
  EmailData,
} from '@/lib/api';
import { safeFetch } from '@/lib/api/client';
import { useInboxThreads } from '@/lib/hooks/useInboxThreads';

import { AdvancedSearchModal, SearchFilterState } from '@/components/inbox/AdvancedSearchModal';
import { SnoozeModal } from '@/components/inbox/SnoozeModal';
import { LabelManagerModal, CustomLabel } from '@/components/inbox/LabelManagerModal';
import { WorkspaceRightPanel } from '@/components/inbox/WorkspaceRightPanel';
import { EmailTemplatesModal, EmailTemplate } from '@/components/inbox/EmailTemplatesModal';
import { ConfidentialModeModal } from '@/components/inbox/ConfidentialModeModal';
import { AttachmentsView } from '@/components/inbox/AttachmentsView';
import { GmailSettingsModal, GmailAppSettings } from '@/components/inbox/GmailSettingsModal';
import { useCopilot } from '@/providers/CopilotContext';
import { InboxHeader } from '@/components/inbox/InboxHeader';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { EmailListPanel } from '@/components/inbox/EmailListPanel';
import { ThreadReaderPanel } from '@/components/inbox/ThreadReaderPanel';
import { ComposeDock } from '@/components/inbox/ComposeDock';
import { useUndoToast } from '@/lib/hooks/useUndoToast';
import { useComposeDraft } from '@/lib/hooks/useComposeDraft';
import { useReplyDrafter } from '@/lib/hooks/useReplyDrafter';
import { filterEmails, groupThreads, paginate } from '@/lib/inbox/filters';
import { ITEMS_PER_PAGE, STORAGE_KEYS, DEFAULT_CUSTOM_LABELS, DEFAULT_TEMPLATES, DEFAULT_APP_SETTINGS } from '@/lib/inbox/constants';
import type { ActiveFolder } from '@/lib/inbox/types';

function InboxContent() {
  const { openCopilot, pendingCount } = useCopilot();
  const searchParams = useSearchParams();
  const urlEmailId = searchParams.get('id');

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<ActiveFolder>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | 'all'>('all');

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(urlEmailId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);

  // View mode: 'list' (Full table), 'split' (Right 2-pane), or 'bottom' (Bottom horizontal split)
  const [viewMode, setViewMode] = useState<'list' | 'split' | 'bottom'>('list');
  const [isReadingThread, setIsReadingThread] = useState(Boolean(urlEmailId));

  // Modals & Productivity State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilterState | null>(null);

  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const [snoozeTargetEmailId, setSnoozeTargetEmailId] = useState<string | null>(null);
  const [snoozedMetaMap, setSnoozedMetaMap] = useState<Record<string, string>>({});
  const [isAiDraftModalOpen, setIsAiDraftModalOpen] = useState(false);
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);

  const [customLabels, setCustomLabels] = useState<CustomLabel[]>(DEFAULT_CUSTOM_LABELS);
  const [emailLabelsMap, setEmailLabelsMap] = useState<Record<string, string[]>>({});
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelTargetEmailId, setLabelTargetEmailId] = useState<string | null>(null);
  const [selectedCustomLabelFilter, setSelectedCustomLabelFilter] = useState<string | 'all'>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Email Templates State
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Confidential Mode State
  const [isConfidentialModalOpen, setIsConfidentialModalOpen] = useState(false);

  // Gmail Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<GmailAppSettings>(DEFAULT_APP_SETTINGS);

  // Floating Compose modal state
  const [iframeHeights, setIframeHeights] = useState<Record<string, number>>({});

  // Pagination state (50 items per page like Gmail)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = ITEMS_PER_PAGE;

  const { emails, accounts, loading, loadData, setEmails } = useInboxThreads({
    hasSelectedEmail: Boolean(selectedEmailId),
    onFirstEmailLoaded: setSelectedEmailId,
  });

  const undo = useUndoToast();
  const composeDraft = useComposeDraft({ accounts, loadData, showUndo: undo.showUndo });

  // Cancel a pending "undo send" if the user navigates away before it fires.
  useEffect(() => {
    return () => undo.cancelPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  // Restore Custom Labels from localStorage
  useEffect(() => {
    const savedLabels = localStorage.getItem(STORAGE_KEYS.customLabels);
    if (savedLabels) {
      try {
        setCustomLabels(JSON.parse(savedLabels));
      } catch (e) {}
    }

    const savedEmailLabels = localStorage.getItem(STORAGE_KEYS.emailLabelsMap);
    if (savedEmailLabels) {
      try {
        setEmailLabelsMap(JSON.parse(savedEmailLabels));
      } catch (e) {}
    }
  }, []);

  // Automatically fetch full HTML body for all messages in current thread if missing
  useEffect(() => {
    if (!selectedEmailId) return;
    const target = emails.find((e) => e.id === selectedEmailId);
    if (!target) return;

    // Find all messages in the selected thread that lack full body
    const threadMsgsToFetch = emails.filter((e) => e.threadId === target.threadId && !e.bodyHtml && !e.bodyText);

    if (threadMsgsToFetch.length === 0) return;

    threadMsgsToFetch.forEach((msg) => {
      fetchEmailByIdApi(msg.id)
        .then((full) => {
          if (full) {
            setEmails((prev) => prev.map((e) => (e.id === msg.id ? { ...e, ...full } : e)));
          }
        })
        .catch((err) => console.warn('Failed to auto-fetch full email details:', err));
    });
  }, [selectedEmailId, emails]);

  // Sync selected email and thread view when URL query 'id' changes or on initial load
  useEffect(() => {
    if (urlEmailId && emails.length > 0) {
      const targetEmail = emails.find((e) => e.id === urlEmailId);
      if (targetEmail) {
        setSelectedEmailId(targetEmail.id);
        setIsReadingThread(true);
      }
    } else if (!urlEmailId && viewMode === 'list') {
      setIsReadingThread(false);
    }
  }, [urlEmailId, emails, viewMode]);

  // Reset modal state whenever user switches emails
  useEffect(() => {
    setIsAiDraftModalOpen(false);
  }, [selectedEmailId]);

  // Handle browser Back / Forward popstate history buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setSelectedEmailId(id);
        setIsReadingThread(true);
      } else if (viewMode === 'list') {
        setIsReadingThread(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewMode]);

  // Listen for iframe height adjustments
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.frameId && typeof event.data.height === 'number') {
        const newH = Math.ceil(event.data.height);
        setIframeHeights((prev) => {
          const prevH = prev[event.data.frameId];
          if (prevH === undefined || Math.abs(prevH - newH) > 4) {
            return { ...prev, [event.data.frameId]: newH };
          }
          return prev;
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Filter emails by active folder, category tab, account label, custom label, search query, and advanced filters
  const filteredEmails = useMemo(
    () =>
      filterEmails(emails, {
        selectedAccountFilter,
        selectedCustomLabelFilter,
        emailLabelsMap,
        activeFolder,
        snoozedMetaMap,
        activeCategory,
        searchQuery,
        advancedFilters,
      }),
    [
      emails,
      selectedAccountFilter,
      selectedCustomLabelFilter,
      emailLabelsMap,
      activeFolder,
      snoozedMetaMap,
      activeCategory,
      searchQuery,
      advancedFilters,
    ],
  );

  // Group emails by threadId, then paginate like Gmail (50 per page)
  const groupedThreads = useMemo(() => groupThreads(filteredEmails), [filteredEmails]);
  const { totalCount, totalPages, startIndex, endIndex, items: paginatedEmails } = useMemo(
    () => paginate(groupedThreads, currentPage, itemsPerPage),
    [groupedThreads, currentPage, itemsPerPage],
  );

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  // All messages in current selected thread
  const currentThreadMessages = selectedEmail
    ? emails
        .filter((e) => e.threadId === selectedEmail.threadId)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    : [];

  const drafter = useReplyDrafter({ selectedEmail, currentThreadMessages, loadData, showUndo: undo.showUndo });

  // GMAIL KEYBOARD SHORTCUTS HANDLER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        composeDraft.openCompose();
      } else if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Search in mail"]')?.focus();
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedEmail) {
          e.preventDefault();
          drafter.startReply('reply');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (selectedEmail) {
          e.preventDefault();
          drafter.startReply('forward');
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedEmail) {
          e.preventDefault();
          handleDeleteEmail(selectedEmail.id);
        }
      } else if (e.key === 'j' || e.key === 'J') {
        if (paginatedEmails.length > 0) {
          const currIndex = paginatedEmails.findIndex((e) => e.id === selectedEmailId);
          const nextIndex = Math.min(paginatedEmails.length - 1, currIndex + 1);
          const nextEmail = paginatedEmails[nextIndex];
          if (nextEmail) handleSelectEmail(nextEmail);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (paginatedEmails.length > 0) {
          const currIndex = paginatedEmails.findIndex((e) => e.id === selectedEmailId);
          const prevIndex = Math.max(0, currIndex - 1);
          const prevEmail = paginatedEmails[prevIndex];
          if (prevEmail) handleSelectEmail(prevEmail);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmail, selectedEmailId, paginatedEmails]);

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

  const handleCategoryShift = async (emailId: string, newCategory: 'primary' | 'promotions' | 'social' | 'updates') => {
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

  const handleSnoozeEmail = (snoozeDate: Date, label: string) => {
    if (!snoozeTargetEmailId) return;
    setEmails((prev) => prev.map((e) => (e.id === snoozeTargetEmailId ? { ...e, folder: 'snoozed' as any } : e)));
    setSnoozedMetaMap((prev) => ({ ...prev, [snoozeTargetEmailId]: label }));
  };

  const handleCreateCustomLabel = (name: string, color: string) => {
    const newLbl: CustomLabel = { id: `lbl-${Date.now()}`, name, color };
    const updated = [...customLabels, newLbl];
    setCustomLabels(updated);
    localStorage.setItem(STORAGE_KEYS.customLabels, JSON.stringify(updated));
  };

  const handleToggleLabelOnEmail = (emailId: string, labelId: string) => {
    setEmailLabelsMap((prev) => {
      const current = prev[emailId] || [];
      const updated = current.includes(labelId) ? current.filter((l) => l !== labelId) : [...current, labelId];
      const nextMap = { ...prev, [emailId]: updated };
      localStorage.setItem(STORAGE_KEYS.emailLabelsMap, JSON.stringify(nextMap));
      return nextMap;
    });
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

  const unreadInboxCount = emails.filter(
    (e) => !e.isRead && ((e as any).folder === 'inbox' || !(e as any).folder),
  ).length;
  const starredCount = emails.filter((e) => e.isStarred).length;

  return (
    <div className="flex flex-col h-full bg-[#f6f8fc] dark:bg-[#1f1f1f] text-[#1f1f1f] dark:text-[#e3e3e3] overflow-hidden font-sans transition-colors duration-200 select-none min-h-0">
      {/* 1. GMAIL TOP SEARCH HEADER BAR */}
      <InboxHeader
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        viewMode={viewMode}
        onSelectListView={() => {
          setViewMode('list');
          handleBackToList();
        }}
        onSelectSplitView={() => setViewMode('split')}
        openCopilot={openCopilot}
        pendingCount={pendingCount}
        loading={loading}
        onSync={() => loadData(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* MAIN BODY AREA */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 2. GMAIL MATERIAL 3 NAVIGATION SIDEBAR */}
        <InboxSidebar
          accountSelector={{
            accounts,
            totalEmailsCount: emails.length,
            selectedAccountFilter,
            isOpen: isAccountDropdownOpen,
            onToggle: () => setIsAccountDropdownOpen(!isAccountDropdownOpen),
            onSelect: (accountId) => {
              setSelectedAccountFilter(accountId);
              setIsAccountDropdownOpen(false);
            },
          }}
          folderNav={{
            activeFolder,
            unreadInboxCount,
            starredCount,
            onSelectFolder: (folderId) => {
              setActiveFolder(folderId);
              setCurrentPage(1);
              if (viewMode === 'list') handleBackToList();
            },
          }}
          labelsNav={{
            customLabels,
            selectedCustomLabelFilter,
            onSelectCustomLabelFilter: setSelectedCustomLabelFilter,
            onOpenLabelModal: () => setIsLabelModalOpen(true),
          }}
          onOpenCompose={composeDraft.openCompose}
        />

        {/* 3. MAIN WORKSPACE CANVAS */}
        {activeFolder === 'attachments' ? (
          <AttachmentsView emails={emails} onJumpToEmail={handleSelectEmail} />
        ) : (
          <div className="flex-1 flex bg-white dark:bg-[#141517] overflow-hidden rounded-tl-2xl border-l border-slate-200/80 dark:border-slate-800 shadow-xs min-h-0">
            {/* A. EMAIL LIST / TABLE PANEL */}
            {(!isReadingThread || viewMode === 'split') && (
              <EmailListPanel
                viewMode={viewMode}
                activeFolder={activeFolder}
                activeCategory={activeCategory}
                onSelectCategory={(categoryId) => {
                  setActiveCategory(categoryId);
                  setCurrentPage(1);
                }}
                emails={emails}
                accounts={accounts}
                selectedAccountFilter={selectedAccountFilter}
                paginatedEmails={paginatedEmails}
                selectedEmailId={selectedEmailId}
                selectedThreadId={selectedEmail?.threadId}
                selectedEmailIds={selectedEmailIds}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelectEmail={toggleSelectEmail}
                onSelectEmail={handleSelectEmail}
                customLabels={customLabels}
                emailLabelsMap={emailLabelsMap}
                loading={loading}
                isAutoLabeling={isAutoLabeling}
                onRefresh={() => loadData(true)}
                onActionResolved={() => loadData(false)}
                onAutoLabelAll={handleAutoLabelAll}
                onBulkMarkRead={handleBulkMarkRead}
                onBulkDelete={handleBulkDelete}
                pagination={{
                  totalCount,
                  totalPages,
                  startIndex,
                  endIndex,
                  currentPage,
                  onPrevPage: () => setCurrentPage((p) => Math.max(1, p - 1)),
                  onNextPage: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
                }}
                rowActions={{
                  onToggleStar: handleToggleStar,
                  onFilterBySender: (email) => setSearchQuery(`from:${email}`),
                  onComposeToSender: composeDraft.prefillComposeTo,
                  onSnooze: (emailId) => {
                    setSnoozeTargetEmailId(emailId);
                    setIsSnoozeModalOpen(true);
                  },
                  onOpenLabels: (emailId) => {
                    setLabelTargetEmailId(emailId);
                    setIsLabelModalOpen(true);
                  },
                  onDelete: handleDeleteEmail,
                }}
              />
            )}

            {/* B. THREAD READER CANVAS */}
            {(isReadingThread || viewMode === 'split') && (
              <ThreadReaderPanel
                selectedEmail={selectedEmail}
                currentThreadMessages={currentThreadMessages}
                viewMode={viewMode}
                isCategoryDropdownOpen={isCategoryDropdownOpen}
                onToggleCategoryDropdown={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                onBackToList={handleBackToList}
                onShiftCategory={(category) => {
                  if (selectedEmail) handleCategoryShift(selectedEmail.id, category);
                  setIsCategoryDropdownOpen(false);
                }}
                onSnooze={() => {
                  if (selectedEmail) {
                    setSnoozeTargetEmailId(selectedEmail.id);
                    setIsSnoozeModalOpen(true);
                  }
                }}
                onOpenLabels={() => {
                  if (selectedEmail) {
                    setLabelTargetEmailId(selectedEmail.id);
                    setIsLabelModalOpen(true);
                  }
                }}
                onToggleStar={() => selectedEmail && handleToggleStar(selectedEmail.id)}
                onDelete={() => selectedEmail && handleDeleteEmail(selectedEmail.id)}
                onReanalyze={() => selectedEmail && handleLabelSingleEmail(selectedEmail.id)}
                onAcceptTask={async (task) => {
                  if (!selectedEmail) return;
                  await safeFetch('/ai/tasks/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      emailId: selectedEmail.id,
                      taskId: task.id,
                      title: task.title,
                      priority: task.priority,
                      dueDate: task.dueDate,
                    }),
                  });
                  loadData(true);
                }}
                onFilterBySender={(email) => setSearchQuery(`from:${email}`)}
                onComposeToSender={composeDraft.prefillComposeTo}
                drafter={drafter}
                isAiDraftModalOpen={isAiDraftModalOpen}
                onOpenAiDraft={() => setIsAiDraftModalOpen(true)}
                onCloseAiDraft={() => setIsAiDraftModalOpen(false)}
                onOpenTemplates={() => setIsTemplatesModalOpen(true)}
              />
            )}

          </div>
        )}

        {/* 4. WORKSPACE RIGHT SIDE PANEL (Google Calendar, Tasks, Notes) */}
        <WorkspaceRightPanel currentEmailSubject={selectedEmail?.subject} currentEmailId={selectedEmail?.id} />
      </div>

      {/* FLOATING UNDO SEND TOAST NOTIFICATION */}
      {undo.undoToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#1e1e1e] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-4 border border-slate-700 animate-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-semibold">{undo.undoToast.message}</span>
          <button
            onClick={undo.undoToast.onUndo}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#c2e7ff] text-[#001d35] text-xs font-bold hover:bg-[#b3d7f0] transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5 text-[#0b57d0]" />
            <span>Undo ({undo.undoToast.countdown}s)</span>
          </button>
        </div>
      )}

      {/* GMAIL FLOATING BOTTOM-RIGHT COMPOSE DOCK */}
      <ComposeDock
        draft={composeDraft}
        accounts={accounts}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        onOpenConfidentialModal={() => setIsConfidentialModalOpen(true)}
      />

      {/* Modals */}
      <AdvancedSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onApplyFilters={(filters) => setAdvancedFilters(filters)}
        onResetFilters={() => setAdvancedFilters(null)}
      />

      <SnoozeModal
        isOpen={isSnoozeModalOpen}
        onClose={() => setIsSnoozeModalOpen(false)}
        onSnooze={handleSnoozeEmail}
      />

      <LabelManagerModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        labels={customLabels}
        onCreateLabel={handleCreateCustomLabel}
        onToggleLabelOnEmail={(lblId) => labelTargetEmailId && handleToggleLabelOnEmail(labelTargetEmailId, lblId)}
        assignedLabelIds={labelTargetEmailId ? emailLabelsMap[labelTargetEmailId] || [] : []}
      />

      <EmailTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        templates={savedTemplates}
        onSelectTemplate={(tpl) => {
          if (tpl.subject && !composeDraft.composeSubject) composeDraft.setComposeSubject(tpl.subject);
          composeDraft.setComposeBody((prev) => (prev ? `${prev}\n\n${tpl.body}` : tpl.body));
        }}
        onCreateTemplate={(title, subject, body) => {
          setSavedTemplates((prev) => [...prev, { id: `tpl-${Date.now()}`, title, subject, body }]);
        }}
        onDeleteTemplate={(id) => setSavedTemplates((prev) => prev.filter((t) => t.id !== id))}
      />

      <ConfidentialModeModal
        isOpen={isConfidentialModalOpen}
        onClose={() => setIsConfidentialModalOpen(false)}
        currentConfig={composeDraft.confidentialConfig}
        onSave={(config) => composeDraft.setConfidentialConfig(config)}
      />

      <GmailSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={appSettings}
        onUpdateSettings={(newSettings) => setAppSettings((prev) => ({ ...prev, ...newSettings }))}
        accounts={accounts}
        onRefreshAccounts={loadData}
        customLabels={customLabels}
        onCreateLabel={handleCreateCustomLabel}
        onDeleteLabel={(id) => {
          const updated = customLabels.filter((l) => l.id !== id);
          setCustomLabels(updated);
          localStorage.setItem(STORAGE_KEYS.customLabels, JSON.stringify(updated));
        }}
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <SectionErrorBoundary sectionName="Inbox">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading Gmail...</div>
        }
      >
        <InboxContent />
      </Suspense>
    </SectionErrorBoundary>
  );
}
