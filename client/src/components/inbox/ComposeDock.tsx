'use client';

import { Minus, Maximize2, Minimize2, X, ChevronDown, Paperclip, FileText, Lock, Trash2 } from 'lucide-react';
import type { AccountData } from '@/lib/api';
import type { UseComposeDraftResult } from '@/lib/hooks/useComposeDraft';
import { formatFileSize } from '@/lib/inbox/format';

interface ComposeDockProps {
  draft: UseComposeDraftResult;
  accounts: AccountData[];
  onOpenTemplates: () => void;
  onOpenConfidentialModal: () => void;
}

export function ComposeDock({ draft, accounts, onOpenTemplates, onOpenConfidentialModal }: ComposeDockProps) {
  const {
    showComposeModal,
    isComposeMinimized,
    isComposeMaximized,
    composeFromAccountId,
    composeTo,
    composeCc,
    composeBcc,
    showCc,
    showBcc,
    composeSubject,
    composeBody,
    composeFiles,
    isSendingCompose,
    isScheduledSendOpen,
    confidentialConfig,
    composeFileInputRef,
    closeCompose,
    discardDraft,
    minimize,
    restore,
    toggleMaximize,
    setComposeFromAccountId,
    setComposeTo,
    setComposeCc,
    setComposeBcc,
    showCcField,
    showBccField,
    setComposeSubject,
    setComposeBody,
    removeComposeFile,
    handleComposeFileSelect,
    toggleScheduledSend,
    closeScheduledSendMenu,
    setScheduledSendTime,
    dispatchSendComposeWithUndo,
  } = draft;

  if (!showComposeModal) return null;

  if (isComposeMinimized) {
    return (
      <div
        onClick={restore}
        className="fixed bottom-0 right-16 z-50 bg-[#1f1f1f] hover:bg-slate-800 text-white rounded-t-xl px-5 py-3 text-xs font-semibold shadow-2xl flex items-center space-x-4 cursor-pointer transition-all border-t border-x border-slate-700"
      >
        <span>New Message</span>
        <div className="flex items-center space-x-2 text-slate-400">
          <button
            onClick={(e) => {
              e.stopPropagation();
              restore();
            }}
            className="hover:text-white"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeCompose();
            }}
            className="hover:text-white"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 bg-white dark:bg-[#1e1e1e] border border-slate-200/90 dark:border-slate-800 rounded-t-2xl shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
        isComposeMaximized ? 'inset-6 rounded-2xl' : 'bottom-0 right-16 w-[580px] h-[540px]'
      }`}
    >
      <input type="file" ref={composeFileInputRef} multiple className="hidden" style={{ display: 'none' }} onChange={handleComposeFileSelect} />

      {/* Compose Header Bar */}
      <div className="bg-[#f2f6fc] dark:bg-slate-800 text-[#1f1f1f] dark:text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shrink-0 select-none border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-bold tracking-tight">New Message</span>
        <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
          <button onClick={minimize} className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors" title="Minimize">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleMaximize}
            className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={isComposeMaximized ? 'Restore' : 'Maximize'}
          >
            {isComposeMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={closeCompose} className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compose Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          dispatchSendComposeWithUndo();
        }}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
          {/* From Field (Select Sender Account) */}
          <div className="px-4 py-2 flex items-center space-x-2 text-xs bg-[#f6f8fc]/40 dark:bg-slate-900/40">
            <span className="text-slate-400 font-semibold w-8 shrink-0">From</span>
            <select
              value={composeFromAccountId}
              onChange={(e) => setComposeFromAccountId(e.target.value)}
              className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white font-semibold text-xs cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">
                  {acc.label} &lt;{acc.email}&gt;
                </option>
              ))}
            </select>
          </div>

          {/* To Field */}
          <div className="px-4 py-2 flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-semibold w-8 shrink-0">To</span>
            <input
              type="email"
              required
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              placeholder="Recipients"
              className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
            />
            <div className="flex items-center space-x-2 text-slate-400 text-[11px] font-mono">
              {!showCc && (
                <button type="button" onClick={showCcField} className="hover:text-[#0b57d0]">
                  Cc
                </button>
              )}
              {!showBcc && (
                <button type="button" onClick={showBccField} className="hover:text-[#0b57d0]">
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* Cc Field */}
          {showCc && (
            <div className="px-4 py-2 flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-semibold w-8 shrink-0">Cc</span>
              <input
                type="email"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                placeholder="Cc recipients"
                className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
              />
            </div>
          )}

          {/* Bcc Field */}
          {showBcc && (
            <div className="px-4 py-2 flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-semibold w-8 shrink-0">Bcc</span>
              <input
                type="email"
                value={composeBcc}
                onChange={(e) => setComposeBcc(e.target.value)}
                placeholder="Bcc recipients"
                className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="px-4 py-2 flex items-center text-xs">
            <input
              type="text"
              required
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white font-medium text-xs"
            />
          </div>
        </div>

        {/* Body Textarea */}
        <div className="flex-1 p-4 flex flex-col min-h-0 space-y-2">
          {confidentialConfig && (
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between">
              <span className="flex items-center space-x-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Confidential mode ({confidentialConfig.expiration})</span>
              </span>
              <button type="button" onClick={() => draft.setConfidentialConfig(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <textarea
            required
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            placeholder="Write your email here..."
            className="flex-1 w-full bg-transparent border-0 focus:outline-none text-xs text-slate-900 dark:text-white leading-relaxed resize-none"
          />

          {composeFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {composeFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0]"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#0b57d0]" />
                  <span className="truncate max-w-[160px] font-medium">{file.filename}</span>
                  <span className="text-[10px] opacity-70 font-mono">({formatFileSize(file.size)})</span>
                  <button type="button" onClick={() => removeComposeFile(idx)} className="text-slate-400 hover:text-rose-600 ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compose Action Bar */}
        <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc] dark:bg-[#1a1b1e] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center">
              <button
                type="submit"
                disabled={isSendingCompose}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-l-full bg-[#0b57d0] hover:bg-[#0a4ab8] text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <span>{isSendingCompose ? 'Sending...' : 'Send'}</span>
              </button>
              <button
                type="button"
                onClick={toggleScheduledSend}
                className="px-2 py-2.5 rounded-r-full bg-[#0a4ab8] hover:bg-[#083b94] text-white border-l border-blue-400/40"
                title="Schedule send"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isScheduledSendOpen && (
                <div className="absolute left-0 bottom-12 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl z-50 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Schedule Send</span>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledSendTime('Tomorrow 8:00 AM');
                      closeScheduledSendMenu();
                      dispatchSendComposeWithUndo();
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Tomorrow morning (8 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledSendTime('Monday 8:00 AM');
                      closeScheduledSendMenu();
                      dispatchSendComposeWithUndo();
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Next Monday (8 AM)
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => composeFileInputRef.current?.click()}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-[#0b57d0]"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenTemplates}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-[#0b57d0]"
              title="Insert template"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenConfidentialModal}
              className={`p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors ${confidentialConfig ? 'text-amber-500 font-bold' : 'text-slate-400'}`}
              title="Toggle Confidential Mode"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>

          <button type="button" onClick={discardDraft} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Discard draft">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
