import React from 'react';
import { Send, CornerUpLeft, CornerUpRight, Paperclip } from 'lucide-react';

interface InlineReplyFormProps {
  replyMode: 'reply' | 'forward';
  setReplyMode: (mode: 'reply' | 'forward') => void;
  replyText: string;
  setReplyText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
}

export function InlineReplyForm({
  replyMode,
  setReplyMode,
  replyText,
  setReplyText,
  onSend,
  isSending,
}: InlineReplyFormProps) {
  return (
    <div className="m-6 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setReplyMode('reply')}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded ${
            replyMode === 'reply' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-gray-500'
          }`}
        >
          <CornerUpLeft className="w-3.5 h-3.5" /> Reply
        </button>
        <button
          onClick={() => setReplyMode('forward')}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded ${
            replyMode === 'forward' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-gray-500'
          }`}
        >
          <CornerUpRight className="w-3.5 h-3.5" /> Forward
        </button>
      </div>

      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder={replyMode === 'reply' ? 'Write a reply...' : 'Forward message with note...'}
        className="w-full h-24 text-sm p-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:border-blue-500 resize-none text-gray-900 dark:text-gray-100"
      />

      <div className="flex items-center justify-between mt-3">
        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
          <Paperclip className="w-4 h-4" />
        </button>
        <button
          onClick={onSend}
          disabled={isSending || !replyText.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
