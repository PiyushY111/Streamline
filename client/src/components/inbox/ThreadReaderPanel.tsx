'use client';

import {
  ArrowLeft,
  ChevronDown,
  FolderInput,
  Clock,
  Tag,
  Star,
  Trash2,
  Printer,
  Sparkles,
  Flame,
  RefreshCw,
  Users,
  AlertOctagon,
  Inbox as InboxIcon,
} from 'lucide-react';
import { ThreadMessageCard } from '@/components/inbox/ThreadMessageCard';
import { ThreadReplyBox } from '@/components/inbox/ThreadReplyBox';
import { AiReplyDrafterModal } from '@/components/inbox/AiReplyDrafterModal';
import type { UseReplyDrafterResult } from '@/lib/hooks/useReplyDrafter';
import type { EmailData } from '@/lib/api';
import type { MoveToCategory } from '@/lib/inbox/types';

const MOVE_TO_CATEGORY_OPTIONS = [
  { id: 'primary', label: 'Primary', icon: InboxIcon, color: 'text-[#0b57d0]' },
  { id: 'promotions', label: 'Promotions', icon: Tag, color: 'text-emerald-600' },
  { id: 'social', label: 'Social', icon: Users, color: 'text-blue-600' },
  { id: 'updates', label: 'Updates', icon: AlertOctagon, color: 'text-amber-600' },
] as const;

interface ExtractedTask {
  id?: string;
  title: string;
  priority?: string;
  dueDate?: string;
}

interface ThreadReaderPanelProps {
  selectedEmail: EmailData | undefined;
  currentThreadMessages: EmailData[];
  viewMode: 'list' | 'split' | 'bottom';
  isCategoryDropdownOpen: boolean;
  onToggleCategoryDropdown: () => void;
  onBackToList: () => void;
  onShiftCategory: (category: MoveToCategory) => void;
  onSnooze: () => void;
  onOpenLabels: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onReanalyze: () => void;
  onAcceptTask: (task: ExtractedTask) => void;
  onFilterBySender: (email: string) => void;
  onComposeToSender: (email: string) => void;
  drafter: UseReplyDrafterResult;
  isAiDraftModalOpen: boolean;
  onOpenAiDraft: () => void;
  onCloseAiDraft: () => void;
  onOpenTemplates: () => void;
}

export function ThreadReaderPanel({
  selectedEmail,
  currentThreadMessages,
  viewMode,
  isCategoryDropdownOpen,
  onToggleCategoryDropdown,
  onBackToList,
  onShiftCategory,
  onSnooze,
  onOpenLabels,
  onToggleStar,
  onDelete,
  onReanalyze,
  onAcceptTask,
  onFilterBySender,
  onComposeToSender,
  drafter,
  isAiDraftModalOpen,
  onOpenAiDraft,
  onCloseAiDraft,
  onOpenTemplates,
}: ThreadReaderPanelProps) {
  if (!selectedEmail) {
    return viewMode === 'split' ? (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-3 bg-slate-50/50 dark:bg-[#141517]">
        <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Email Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm">Select an email thread from your inbox to view full details.</p>
      </div>
    ) : null;
  }

  const hasAiIntelligence = Boolean(
    selectedEmail.aiPriority ||
      selectedEmail.aiSummary ||
      (selectedEmail.aiExtractedTasks && selectedEmail.aiExtractedTasks.length > 0) ||
      selectedEmail.aiNewsletterTopic,
  );

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#141517] overflow-hidden min-w-0 h-full">
      <input type="file" ref={drafter.replyFileInputRef} multiple className="hidden" style={{ display: 'none' }} onChange={drafter.handleReplyFileSelect} />

      {/* Thread Action Header Bar */}
      <div className="px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-[#f6f8fc]/40 dark:bg-[#1a1b1e]">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToList}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Back to inbox"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs"
            style={{
              backgroundColor: `${selectedEmail.accountColor || '#0b57d0'}20`,
              color: selectedEmail.accountColor || '#0b57d0',
              border: `1px solid ${selectedEmail.accountColor || '#0b57d0'}40`,
            }}
            title={`Belongs to mailbox: ${selectedEmail.accountName || selectedEmail.accountEmail}`}
          >
            {selectedEmail.accountName || selectedEmail.accountEmail || 'Mailbox'}
          </span>

          {/* Shift Category Pill Dropdown */}
          <div className="relative">
            <button
              onClick={onToggleCategoryDropdown}
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all shadow-2xs cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: `${selectedEmail.accountColor || '#0b57d0'}15`,
                color: selectedEmail.accountColor || '#0b57d0',
                borderColor: `${selectedEmail.accountColor || '#0b57d0'}40`,
              }}
              title="Move to category"
            >
              <FolderInput className="w-3 h-3" />
              <span className="capitalize">{selectedEmail.category || 'primary'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute left-0 mt-2 w-44 rounded-2xl bg-white dark:bg-[#1a1b1e] border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Move to Category</div>
                {MOVE_TO_CATEGORY_OPTIONS.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onShiftCategory(cat.id)}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        (selectedEmail.category || 'primary') === cat.id
                          ? 'font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onSnooze}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Snooze email"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenLabels}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Labels"
          >
            <Tag className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleStar}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Star message"
          >
            <Star className={`w-4 h-4 ${selectedEmail.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : ''}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
            title="Delete message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Print email"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thread Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{selectedEmail.subject}</h1>

        {/* Gemini AI Intelligence Card */}
        {hasAiIntelligence && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/8 via-indigo-500/5 to-pink-500/8 border border-purple-200/80 dark:border-purple-800/50 space-y-3 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Gemini Intelligence
                </span>

                {selectedEmail.aiPriority === 'p1_urgent' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center space-x-1">
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>P1 Action Required</span>
                  </span>
                )}
                {selectedEmail.aiPriority === 'p2_important' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    💬 P2 Direct
                  </span>
                )}
                {selectedEmail.aiPriority === 'p3_updates' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    🔔 P3 Updates
                  </span>
                )}
                {selectedEmail.aiPriority === 'p4_newsletter' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    📰 P4 Subscription
                  </span>
                )}

                {selectedEmail.aiUrgencyScore !== undefined && selectedEmail.aiUrgencyScore !== null && (
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    Urgency: {selectedEmail.aiUrgencyScore}/100
                  </span>
                )}

                {selectedEmail.aiNewsletterTopic && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                    {selectedEmail.aiNewsletterTopic}
                  </span>
                )}
              </div>

              <button
                onClick={onReanalyze}
                className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 transition-colors"
                title="Re-analyze email with Gemini AI"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-analyze</span>
              </button>
            </div>

            {selectedEmail.aiSummary && (
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/50 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30">
                <span className="font-bold text-slate-900 dark:text-white mr-1.5">Executive Summary:</span>
                {selectedEmail.aiSummary}
              </div>
            )}

            {selectedEmail.aiExtractedTasks && selectedEmail.aiExtractedTasks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Extracted Action Items ({selectedEmail.aiExtractedTasks.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(selectedEmail.aiExtractedTasks as ExtractedTask[]).map((t) => (
                    <div
                      key={t.id || t.title}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs space-x-2 shadow-2xs"
                    >
                      <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{t.title}</span>
                      <button
                        onClick={() => onAcceptTask(t)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] font-bold shrink-0 shadow-2xs transition-all active:scale-95"
                      >
                        Accept Task
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chronological Messages Flow */}
        <div className="space-y-6">
          {currentThreadMessages.map((msg) => (
            <ThreadMessageCard key={msg.id} message={msg} onFilterBySender={onFilterBySender} onComposeToSender={onComposeToSender} />
          ))}
        </div>
      </div>

      {/* Bottom Action Area (Reply & Forward Box) */}
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc]/60 dark:bg-[#1a1b1e] shrink-0 space-y-3">
        <ThreadReplyBox
          drafter={drafter}
          replyToLabel={selectedEmail.sender}
          onOpenAiDraft={onOpenAiDraft}
          onOpenTemplates={onOpenTemplates}
        />
      </div>

      {/* Gemini AI Reply Drafter Modal */}
      <AiReplyDrafterModal
        isOpen={isAiDraftModalOpen}
        onClose={onCloseAiDraft}
        threadId={selectedEmail.threadId || selectedEmail.id}
        emailId={selectedEmail.id}
        threadSubject={selectedEmail.subject}
        emailContext={
          currentThreadMessages.length > 0
            ? currentThreadMessages
                .map(
                  (m, idx) =>
                    `[Message ${idx + 1} of ${currentThreadMessages.length}]\nFrom: ${m.sender}\nTo: ${m.recipients}\nDate: ${new Date(m.receivedAt).toLocaleString()}\nSubject: ${m.subject || ''}\nBody:\n${m.bodyText || m.snippet || ''}`,
                )
                .join('\n\n------------------------\n\n')
            : `From: ${selectedEmail.sender}\nTo: ${selectedEmail.recipients}\nSubject: ${selectedEmail.subject || ''}\nBody:\n${selectedEmail.bodyText || selectedEmail.snippet || ''}`
        }
        onInsertDraft={drafter.insertAiDraft}
      />
    </div>
  );
}
