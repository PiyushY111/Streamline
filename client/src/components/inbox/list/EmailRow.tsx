import React from 'react';
import { Star, Square, CheckSquare, Paperclip } from 'lucide-react';
import { EmailData } from '@/lib/api';

interface EmailRowProps {
  email: EmailData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStar: (id: string, isStarred: boolean) => void;
  onClick: (email: EmailData) => void;
}

export function EmailRow({ email, isSelected, onSelect, onStar, onClick }: EmailRowProps) {
  return (
    <tr
      onClick={() => onClick(email)}
      className={`group cursor-pointer border-b border-gray-100 dark:border-gray-800/60 transition-colors ${
        !email.isRead
          ? 'bg-blue-50/40 dark:bg-blue-950/20 font-semibold'
          : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
      } ${isSelected ? 'bg-blue-100/50 dark:bg-blue-900/30' : ''}`}
    >
      <td className="py-3 pl-4 pr-2 w-10" onClick={(e) => { e.stopPropagation(); onSelect(email.id); }}>
        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
        </button>
      </td>
      <td className="py-3 px-2 w-10" onClick={(e) => { e.stopPropagation(); onStar(email.id, !email.isStarred); }}>
        <button className="text-gray-400 hover:text-yellow-500">
          <Star className={`w-4 h-4 ${email.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
      </td>
      <td className="py-3 px-3 w-48 truncate text-sm text-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: email.accountColor || '#3b82f6' }} />
          <span className="truncate">{email.sender}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-sm text-gray-800 dark:text-gray-200 truncate max-w-md">
        <span className="text-gray-900 dark:text-gray-100">{email.subject}</span>
        <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal truncate">- {email.snippet}</span>
      </td>
      <td className="py-3 pr-4 pl-2 w-28 text-right text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  );
}
