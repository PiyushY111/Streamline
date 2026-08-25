import React from 'react';
import { EmailData } from '@/lib/api';
import { EmailRow } from './EmailRow';

interface EmailListTableProps {
  emails: EmailData[];
  selectedEmailIds: string[];
  onSelectEmail: (id: string) => void;
  onStarEmail: (id: string, isStarred: boolean) => void;
  onSelectThread: (email: EmailData) => void;
  loading: boolean;
}

export function EmailListTable({
  emails,
  selectedEmailIds,
  onSelectEmail,
  onStarEmail,
  onSelectThread,
  loading,
}: EmailListTableProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-500">
        Loading emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-sm text-gray-500 dark:text-gray-400">
        No emails found in this view.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <tbody>
          {emails.map(email => (
            <EmailRow
              key={email.id}
              email={email}
              isSelected={selectedEmailIds.includes(email.id)}
              onSelect={onSelectEmail}
              onStar={onStarEmail}
              onClick={onSelectThread}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
