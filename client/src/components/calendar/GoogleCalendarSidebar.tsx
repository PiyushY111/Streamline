import React from 'react';
import { AccountData } from '@/lib/api';
import { MiniCalendar } from './sidebar/MiniCalendar';
import { CalendarList } from './sidebar/CalendarList';

interface GoogleCalendarSidebarProps {
  accounts: AccountData[];
  selectedAccounts: string[];
  onToggleAccount: (id: string) => void;
}

export function GoogleCalendarSidebar({ accounts, selectedAccounts, onToggleAccount }: GoogleCalendarSidebarProps) {
  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col">
      <MiniCalendar />
      <CalendarList accounts={accounts} selectedAccounts={selectedAccounts} onToggleAccount={onToggleAccount} />
    </div>
  );
}
