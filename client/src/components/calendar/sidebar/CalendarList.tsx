import React from 'react';
import { AccountData } from '@/lib/api';

interface CalendarListProps {
  accounts: AccountData[];
  selectedAccounts: string[];
  onToggleAccount: (id: string) => void;
}

export function CalendarList({ accounts, selectedAccounts, onToggleAccount }: CalendarListProps) {
  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Calendars</h3>
      <div className="space-y-2">
        {accounts.map(acc => {
          const isChecked = selectedAccounts.includes(acc.id);
          return (
            <label key={acc.id} className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleAccount(acc.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
              <span className="truncate">{acc.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
