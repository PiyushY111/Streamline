import React from 'react';

interface CalendarViewSelectorProps {
  viewMode: 'day' | 'week' | 'month' | 'year' | 'schedule';
  setViewMode: (mode: 'day' | 'week' | 'month' | 'year' | 'schedule') => void;
}

export function CalendarViewSelector({ viewMode, setViewMode }: CalendarViewSelectorProps) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5 text-xs font-semibold">
      {(['day', 'week', 'month', 'year', 'schedule'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={`px-3 py-1.5 rounded-md capitalize transition-all ${
            viewMode === mode
              ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
