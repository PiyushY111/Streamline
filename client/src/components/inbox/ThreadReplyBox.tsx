'use client';

import { CornerUpLeft, CornerUpRight, Sparkles, FileText, X, Paperclip, Send, Trash2 } from 'lucide-react';
import type { UseReplyDrafterResult } from '@/lib/hooks/useReplyDrafter';

interface ThreadReplyBoxProps {
  drafter: UseReplyDrafterResult;
  replyToLabel: string;
  onOpenAiDraft: () => void;
  onOpenTemplates: () => void;
}

export function ThreadReplyBox({ drafter, replyToLabel, onOpenAiDraft, onOpenTemplates }: ThreadReplyBoxProps) {
  const {
    isReplying,
    replyMode,
    replyText,
    replyFiles,
    isSendingReply,
    replyFileInputRef,
    startReply,
    cancelReply,
    setReplyText,
    removeReplyFile,
    dispatchSendReplyWithUndo,
  } = drafter;

  if (!isReplying) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => startReply('reply')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <CornerUpLeft className="w-4 h-4 text-slate-500" />
            <span>Reply</span>
          </button>

          <button
            onClick={() => startReply('forward')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <CornerUpRight className="w-4 h-4 text-slate-500" />
            <span>Forward</span>
          </button>

          <button
            onClick={onOpenAiDraft}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-purple-600/25 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Draft with Gemini</span>
          </button>
        </div>

        <button
          onClick={onOpenTemplates}
          className="p-2 rounded-xl text-slate-500 hover:text-[#0b57d0] hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1 transition-colors"
          title="Insert Email Template"
        >
          <FileText className="w-4 h-4 text-[#0b57d0]" />
          <span className="hidden sm:inline text-[11px]">Templates</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl space-y-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {replyMode === 'reply' ? (
            <CornerUpLeft className="w-4 h-4 text-[#0b57d0]" />
          ) : (
            <CornerUpRight className="w-4 h-4 text-[#0b57d0]" />
          )}
          <span>{replyMode === 'reply' ? `Reply to ${replyToLabel}` : `Forward message`}</span>
        </div>
        <button onClick={cancelReply} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea
        rows={4}
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Write your response..."
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0] resize-none"
      />

      {replyFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {replyFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0]"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px] font-medium">{file.filename}</span>
              <button type="button" onClick={() => removeReplyFile(idx)} className="text-slate-400 hover:text-rose-600 ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <button
            disabled={isSendingReply || !replyText.trim()}
            onClick={dispatchSendReplyWithUndo}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0a4ab8] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingReply ? 'Sending...' : 'Send'}</span>
          </button>
          <button
            type="button"
            onClick={() => replyFileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-[#0b57d0] transition-colors"
            title="Attach files"
          >
            <Paperclip className="w-4 h-4 text-[#0b57d0]" />
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="p-2 text-slate-400 hover:text-[#0b57d0] transition-colors"
            title="Insert template"
          >
            <FileText className="w-4 h-4 text-[#0b57d0]" />
          </button>
          <button
            type="button"
            onClick={onOpenAiDraft}
            className="p-1.5 px-2.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors flex items-center space-x-1"
            title="Draft with Gemini"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hidden sm:inline">AI Draft</span>
          </button>
        </div>

        <button onClick={cancelReply} className="p-2 text-slate-400 hover:text-rose-600" title="Discard draft">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
