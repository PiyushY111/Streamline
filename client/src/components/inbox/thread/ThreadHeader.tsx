import React from 'react';
import { ArrowLeft, Star, Trash2, Printer } from 'lucide-react';
import { EmailData } from '@/lib/api';

interface ThreadHeaderProps {
  email: EmailData;
  onBack: () => void;
  onStar: (id: string, isStarred: boolean) => void;
  onDelete: (id: string) => void;
}

export function ThreadHeader({ email, onBack, onStar, onDelete }: ThreadHeaderProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-950">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onStar(email.id, !email.isStarred)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 hover:text-yellow-500"
          >
            <Star className={`w-4 h-4 ${email.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
          <button
            onClick={() => onDelete(email.id)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{email.subject}</h1>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-200">{email.sender}</span>
          <span>to {email.recipients}</span>
        </div>
        <span>{new Date(email.receivedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
