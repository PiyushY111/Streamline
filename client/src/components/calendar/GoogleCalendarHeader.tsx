import React from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { CalendarNavControls } from './header/CalendarNavControls';
import { CalendarViewSelector } from './header/CalendarViewSelector';
import { ThemeToggle } from '../layout/ThemeToggle';

interface GoogleCalendarHeaderProps {
  currentDateTitle: string;
  viewMode: 'day' | 'week' | 'month' | 'year' | 'schedule';
  setViewMode: (mode: 'day' | 'week' | 'month' | 'year' | 'schedule') => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onQuickCreate: () => void;
}

export function GoogleCalendarHeader({
  currentDateTitle,
  viewMode,
  setViewMode,
  onToday,
  onPrev,
  onNext,
  onQuickCreate,
}: GoogleCalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="flex items-center gap-6">
        <button
          onClick={onQuickCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-full shadow-md transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>

        <CalendarNavControls
          onToday={onToday}
          onPrev={onPrev}
          onNext={onNext}
          currentDateTitle={currentDateTitle}
        />
      </div>

      <div className="flex items-center gap-4">
        <CalendarViewSelector viewMode={viewMode} setViewMode={setViewMode} />
        <ThemeToggle />
      </div>
    </div>
  );
}
