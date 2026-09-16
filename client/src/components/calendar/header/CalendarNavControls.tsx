import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarNavControlsProps {
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentDateTitle: string;
}

export function CalendarNavControls({ onToday, onPrev, onNext, currentDateTitle }: CalendarNavControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToday}
        className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
      >
        Today
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          title="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          title="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 ml-2 tracking-tight">{currentDateTitle}</h2>
    </div>
  );
}
