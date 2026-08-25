import React from 'react';
import { Search, SlidersHorizontal, ChevronDown, Plus } from 'lucide-react';
import { AccountData } from '@/lib/api';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

interface InboxHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenAdvancedSearch: () => void;
  accounts: AccountData[];
  selectedAccountFilter: string;
  setSelectedAccountFilter: (id: string) => void;
  isAccountDropdownOpen: boolean;
  setIsAccountDropdownOpen: (open: boolean) => void;
  onOpenCompose: () => void;
}

export function InboxHeader({
  searchQuery,
  setSearchQuery,
  onOpenAdvancedSearch,
  accounts,
  selectedAccountFilter,
  setSelectedAccountFilter,
  isAccountDropdownOpen,
  setIsAccountDropdownOpen,
  onOpenCompose,
}: InboxHeaderProps) {
  const activeAccount = accounts.find(a => a.id === selectedAccountFilter);

  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <button
          onClick={onOpenCompose}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-full shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>

        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mail by sender, subject or keyword..."
            className="w-full pl-10 pr-10 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-transparent rounded-lg focus:outline-none focus:bg-white dark:focus:bg-gray-950 focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={onOpenAdvancedSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeAccount?.color || '#3b82f6' }} />
            {activeAccount ? activeAccount.label : 'All Inboxes'}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {isAccountDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-800 py-1 z-30">
              <button
                onClick={() => { setSelectedAccountFilter('all'); setIsAccountDropdownOpen(false); }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                All Accounts
              </button>
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setSelectedAccountFilter(acc.id); setIsAccountDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
