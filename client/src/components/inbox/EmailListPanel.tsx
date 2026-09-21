'use client';

import {
  AlertOctagon,
  CheckSquare,
  Square,
  MailOpen,
  Trash2,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Mail,
  Flame,
  Inbox as InboxIcon,
  Tag,
} from 'lucide-react';
import { PendingActionsBanner } from '@/components/agent/PendingActionsBanner';
import { EmailListRow } from '@/components/inbox/EmailListRow';
import type { CustomLabel } from '@/components/inbox/LabelManagerModal';
import { getEmailCategory } from '@/lib/inbox/categorize';
import type { PaginationResult, EmailThreadSummary } from '@/lib/inbox/filters';
import type { EmailData, AccountData } from '@/lib/api';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Mail', icon: Mail, color: 'border-slate-600 text-slate-600 dark:border-slate-300 dark:text-slate-300' },
  { id: 'p1_urgent', label: '🔥 Action Required', icon: Flame, color: 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400' },
  { id: 'p2_important', label: '💬 Direct', icon: InboxIcon, color: 'border-[#0b57d0] text-[#0b57d0] dark:border-purple-400 dark:text-purple-400' },
  { id: 'p3_updates', label: '🔔 Updates', icon: AlertOctagon, color: 'border-[#b06000] text-[#b06000] dark:border-amber-400 dark:text-amber-400' },
  { id: 'p4_newsletter', label: '📰 Subscriptions', icon: Tag, color: 'border-[#137333] text-[#137333] dark:border-emerald-400 dark:text-emerald-400' },
] as const;

interface RowActions {
  onToggleStar: (emailId: string) => void;
  onFilterBySender: (email: string) => void;
  onComposeToSender: (email: string) => void;
  onSnooze: (emailId: string) => void;
  onOpenLabels: (emailId: string) => void;
  onDelete: (emailId: string) => void;
}

interface EmailListPanelProps {
  viewMode: 'list' | 'split' | 'bottom';
  activeFolder: string;
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  emails: EmailData[];
  accounts: AccountData[];
  selectedAccountFilter: string | 'all';
  paginatedEmails: EmailThreadSummary[];
  selectedEmailId: string | null;
  selectedThreadId?: string;
  selectedEmailIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectEmail: (id: string) => void;
  onSelectEmail: (email: EmailThreadSummary) => void;
  customLabels: CustomLabel[];
  emailLabelsMap: Record<string, string[]>;
  loading: boolean;
  isAutoLabeling: boolean;
  onRefresh: () => void;
  onActionResolved: () => void;
  onAutoLabelAll: () => void;
  onBulkMarkRead: () => void;
  onBulkDelete: () => void;
  pagination: Pick<PaginationResult<unknown>, 'totalCount' | 'totalPages' | 'startIndex' | 'endIndex'> & {
    currentPage: number;
    onPrevPage: () => void;
    onNextPage: () => void;
  };
  rowActions: RowActions;
}

export function EmailListPanel({
  viewMode,
  activeFolder,
  activeCategory,
  onSelectCategory,
  emails,
  accounts,
  selectedAccountFilter,
  paginatedEmails,
  selectedEmailId,
  selectedThreadId,
  selectedEmailIds,
  onToggleSelectAll,
  onToggleSelectEmail,
  onSelectEmail,
  customLabels,
  emailLabelsMap,
  loading,
  isAutoLabeling,
  onRefresh,
  onActionResolved,
  onAutoLabelAll,
  onBulkMarkRead,
  onBulkDelete,
  pagination,
  rowActions,
}: EmailListPanelProps) {
  const { totalCount, totalPages, startIndex, endIndex, currentPage, onPrevPage, onNextPage } = pagination;

  return (
    <div
      className={`flex flex-col bg-white dark:bg-[#141517] border-r border-slate-200/80 dark:border-slate-800 ${
        viewMode === 'split' ? 'w-96 shrink-0' : 'w-full'
      } h-full overflow-hidden min-h-0`}
    >
      {/* Account OAuth Re-Authentication Warning Banner */}
      {accounts.some((a) => a.status === 'error') && (
        <div className="mx-4 my-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center space-x-2.5">
            <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Google OAuth session expired for{' '}
              <strong>
                {accounts
                  .filter((a) => a.status === 'error')
                  .map((a) => a.email)
                  .join(', ')}
              </strong>
              .
            </span>
          </div>
          <a
            href="/settings"
            className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors shrink-0 shadow-sm"
          >
            Reconnect in Settings
          </a>
        </div>
      )}

      {/* Top Gmail Action Bar */}
      <div className="px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shrink-0 bg-white dark:bg-[#141517]">
        <div className="flex items-center space-x-3">
          {/* Select All Checkbox */}
          <button
            onClick={onToggleSelectAll}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Select all"
          >
            {selectedEmailIds.length === paginatedEmails.length && paginatedEmails.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Bulk Action Buttons */}
          {selectedEmailIds.length > 0 ? (
            <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-200">
              <button
                onClick={onBulkMarkRead}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Mark as read"
              >
                <MailOpen className="w-4 h-4" />
              </button>
              <button
                onClick={onBulkDelete}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-medium text-slate-500 ml-2">{selectedEmailIds.length} selected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={onRefresh}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                title="Refresh inbox"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={onAutoLabelAll}
                disabled={isAutoLabeling}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-pink-600/10 hover:from-purple-600/20 hover:to-indigo-600/20 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-[11px] font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-60"
                title="Run Gemini AI Auto-Labeling on all synced emails"
              >
                <Sparkles className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ${isAutoLabeling ? 'animate-spin' : ''}`} />
                <span>{isAutoLabeling ? 'Auto-Labeling with Gemini...' : '✨ AI Auto-Label'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Pagination & Live Push Status */}
        <div className="flex items-center space-x-3 text-slate-500">
          <div
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0"
            title="Google Cloud Pub/Sub & SSE Live Push Ingestion active (<500ms)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">Live Push</span>
          </div>
          <span className="text-[11px] font-mono">
            {totalCount === 0 ? '0 of 0' : `${startIndex + 1}–${endIndex} of ${totalCount}`}
          </span>
          <div className="flex items-center space-x-0.5">
            <button
              disabled={currentPage === 1}
              onClick={onPrevPage}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentPage === totalPages || totalCount === 0}
              onClick={onNextPage}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Gmail Category Tabs Bar (Primary, Promotions, Social, Updates, All Mail) */}
      {activeFolder === 'inbox' && (
        <div className="flex items-center border-b border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc]/60 dark:bg-[#1a1b1e] shrink-0 overflow-x-auto">
          {CATEGORY_TABS.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const count = emails.filter((e) => {
              if (e.folder && e.folder !== 'inbox') return false;
              if (selectedAccountFilter !== 'all' && e.accountId !== selectedAccountFilter) return false;
              if (cat.id === 'all') return true;
              return getEmailCategory(e) === cat.id;
            }).length;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex-1 min-w-[120px] py-3.5 px-4 flex items-center justify-center space-x-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                  isActive ? `${cat.color} bg-white dark:bg-[#141517]` : 'border-transparent text-[#5f6368] dark:text-slate-400 hover:bg-[#eaeff6]/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                      isActive ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Staged AI Actions Awaiting Approval Banner */}
      <div className="p-3 pb-0">
        <PendingActionsBanner onActionResolved={onActionResolved} />
      </div>

      {/* Email Table Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 min-h-0">
        {paginatedEmails.length === 0 ? (
          <div className="p-16 text-center space-y-3 my-auto">
            <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">No emails found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">There are no messages matching your filters.</p>
          </div>
        ) : (
          paginatedEmails.map((email) => (
            <EmailListRow
              key={email.id}
              email={email}
              isSelected={selectedEmailId === email.id || selectedThreadId === email.threadId}
              isChecked={selectedEmailIds.includes(email.id)}
              assignedLabels={emailLabelsMap[email.id] || []}
              customLabels={customLabels}
              onSelect={() => onSelectEmail(email)}
              onToggleCheck={() => onToggleSelectEmail(email.id)}
              onToggleStar={() => rowActions.onToggleStar(email.id)}
              onFilterBySender={rowActions.onFilterBySender}
              onComposeToSender={rowActions.onComposeToSender}
              onSnooze={() => rowActions.onSnooze(email.id)}
              onOpenLabels={() => rowActions.onOpenLabels(email.id)}
              onDelete={() => rowActions.onDelete(email.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
