import React from 'react';
import { Undo2 } from 'lucide-react';

interface UndoSendToastProps {
  toast: {
    message: string;
    countdown: number;
    onUndo: () => void;
  } | null;
  onCancel: () => void;
}

export function UndoSendToast({ toast, onCancel }: UndoSendToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-5 py-3 rounded-lg shadow-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-5">
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
      >
        <Undo2 className="w-3.5 h-3.5" />
        Undo ({toast.countdown}s)
      </button>
    </div>
  );
}
