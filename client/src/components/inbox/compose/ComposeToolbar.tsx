import React from 'react';
import { Send, Paperclip, Lock, FileText } from 'lucide-react';

interface ComposeToolbarProps {
  onSend: () => void;
  isSending: boolean;
  onOpenTemplates: () => void;
  onOpenConfidential: () => void;
}

export function ComposeToolbar({
  onSend,
  isSending,
  onOpenTemplates,
  onOpenConfidential,
}: ComposeToolbarProps) {
  return (
    <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
      <button
        onClick={onSend}
        disabled={isSending}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        {isSending ? 'Sending...' : 'Send'}
      </button>

      <div className="flex items-center gap-2">
        <button onClick={onOpenTemplates} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Email Templates">
          <FileText className="w-4 h-4" />
        </button>
        <button onClick={onOpenConfidential} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Confidential Mode">
          <Lock className="w-4 h-4" />
        </button>
        <button className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Attach File">
          <Paperclip className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
